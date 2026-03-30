import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Inject,
    forwardRef,
  } from '@nestjs/common';
  import { PrismaService } from 'prisma/prisma.service';
  import { NearBookGateway } from '../gateway/gateway.gateway';
  import { RequestGuestbookDto } from './dto/request-guestbook.dto';
  import { SubmitGuestbookDto } from './dto/submit-guestbook.dto';
  
  const REQUEST_EXPIRES_MINUTES = 30;
  
  @Injectable()
  export class GuestbookService {
    constructor(
      private readonly prisma: PrismaService,
      @Inject(forwardRef(() => NearBookGateway))
      private readonly gateway: NearBookGateway,
    ) {}
  
    // ─── 방명록 요청 전송 ───────────────────────────────────────
  
    async requestGuestbook(ownerId: string, dto: RequestGuestbookDto) {
      const writer = await this.prisma.user.findUnique({
        where: { username: dto.writerUsername },
        select: { id: true, username: true, nickname: true },
      });
  
      if (!writer) {
        throw new NotFoundException('존재하지 않는 사용자입니다.');
      }
  
      if (writer.id === ownerId) {
        throw new BadRequestException('자기 자신에게 방명록을 요청할 수 없습니다.');
      }
  
      // 친구 여부 확인
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: ownerId, receiverId: writer.id, status: 'accepted' },
            { requesterId: writer.id, receiverId: ownerId, status: 'accepted' },
          ],
        },
      });
  
      if (!friendship) {
        throw new ForbiddenException('친구에게만 방명록을 요청할 수 있습니다.');
      }
  
      // 이미 진행 중인 요청 확인
      const existingRequest = await this.prisma.guestbookRequest.findFirst({
        where: {
          ownerId,
          writerId: writer.id,
          status: { in: ['pending', 'writing'] },
        },
      });
  
      if (existingRequest) {
        throw new BadRequestException('이미 진행 중인 방명록 요청이 있습니다.');
      }
  
      const expiresAt = new Date(
        Date.now() + REQUEST_EXPIRES_MINUTES * 60 * 1000,
      );
  
      const owner = await this.prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true, username: true, nickname: true, profileImageUrl: true },
      });
  
      const request = await this.prisma.guestbookRequest.create({
        data: { ownerId, writerId: writer.id, expiresAt },
      });
  
      // WebSocket 알림
      this.gateway.emitGuestbookRequestReceived(writer.id, {
        requestId: request.id,
        owner,
        expiresAt: request.expiresAt,
      });
  
      return request;
    }
  
    // ─── 작성 시작 상태 변경 ────────────────────────────────────
  
    async markAsWriting(userId: string, requestId: number) {
      const request = await this.findRequestOrThrow(requestId);
  
      if (request.writerId !== userId) {
        throw new ForbiddenException('권한이 없습니다.');
      }
  
      if (request.status !== 'pending') {
        throw new BadRequestException('처리할 수 없는 요청입니다.');
      }
  
      this.checkExpired(request.expiresAt);
  
      return this.prisma.guestbookRequest.update({
        where: { id: requestId },
        data: { status: 'writing' },
      });
    }
  
    // ─── 방명록 요청 거절 ───────────────────────────────────────
  
    async rejectRequest(userId: string, requestId: number) {
      const request = await this.findRequestOrThrow(requestId);
  
      if (request.writerId !== userId) {
        throw new ForbiddenException('권한이 없습니다.');
      }
  
      if (request.status !== 'pending' && request.status !== 'writing') {
        throw new BadRequestException('처리할 수 없는 요청입니다.');
      }
  
      await this.prisma.guestbookRequest.update({
        where: { id: requestId },
        data: { status: 'rejected' },
      });
  
      // WebSocket 알림
      this.gateway.emitGuestbookRequestRejected(request.ownerId, {
        requestId,
        writer: {
          userId: request.writerId,
        },
      });
  
      return { message: '방명록 요청을 거절했습니다.' };
    }
  
    // ─── 방명록 작성 제출 ───────────────────────────────────────
  
    async submitGuestbook(
      userId: string,
      requestId: number,
      dto: SubmitGuestbookDto,
    ) {
      const request = await this.findRequestOrThrow(requestId);
  
      if (request.writerId !== userId) {
        throw new ForbiddenException('권한이 없습니다.');
      }
  
      if (request.status !== 'pending' && request.status !== 'writing') {
        throw new BadRequestException('처리할 수 없는 요청입니다.');
      }
  
      this.checkExpired(request.expiresAt);
  
      const [entry] = await this.prisma.$transaction([
        this.prisma.guestbookEntry.create({
          data: {
            ownerId: request.ownerId,
            writerId: userId,
            content: dto.content,
          },
        }),
        this.prisma.guestbookRequest.update({
          where: { id: requestId },
          data: { status: 'completed' },
        }),
      ]);
  
      const writer = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, nickname: true, profileImageUrl: true },
      });
  
      // WebSocket 알림
      this.gateway.emitGuestbookCompleted(request.ownerId, {
        entryId: entry.id,
        writer,
        content: dto.content,
        createdAt: entry.createdAt,
      });
  
      return entry;
    }
  
    // ─── 내 방명록 조회 ─────────────────────────────────────────
  
    async getMyGuestbook(
      ownerId: string,
      groupBy: 'writer' | 'date',
    ) {
      const entries = await this.prisma.guestbookEntry.findMany({
        where: { ownerId },
        include: {
          writer: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
  
      if (groupBy === 'writer') {
        return this.groupByWriter(entries);
      }
  
      return this.groupByDate(entries);
    }
  
    // ─── Private 헬퍼 ──────────────────────────────────────────
  
    private async findRequestOrThrow(requestId: number) {
      const request = await this.prisma.guestbookRequest.findUnique({
        where: { id: requestId },
      });
  
      if (!request) {
        throw new NotFoundException('방명록 요청을 찾을 수 없습니다.');
      }
  
      return request;
    }
  
    private checkExpired(expiresAt: Date): void {
      if (new Date() > expiresAt) {
        throw new BadRequestException('만료된 방명록 요청입니다.');
      }
    }
  
    private groupByWriter(entries: any[]) {
      const map = new Map<string, { writer: object; entries: object[] }>();
  
      for (const entry of entries) {
        const writerId = entry.writer.id;
  
        if (!map.has(writerId)) {
          map.set(writerId, { writer: entry.writer, entries: [] });
        }
  
        map.get(writerId)!.entries.push({
          id: entry.id,
          content: entry.content,
          createdAt: entry.createdAt,
        });
      }
  
      return Array.from(map.values());
    }
  
    private groupByDate(entries: any[]) {
      const map = new Map<string, { date: string; entries: object[] }>();
  
      for (const entry of entries) {
        const date = entry.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
  
        if (!map.has(date)) {
          map.set(date, { date, entries: [] });
        }
  
        map.get(date)!.entries.push({
          id: entry.id,
          content: entry.content,
          createdAt: entry.createdAt,
          writer: entry.writer,
        });
      }
  
      return Array.from(map.values());
    }
  }