import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

type SubscribePayload = {
  submissionId: string;
};

@WebSocketGateway({
  namespace: 'analysis-stream',
  cors: true,
})
export class AnalysisStreamGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('analysis.subscribe')
  async subscribe(client: Socket, @MessageBody() payload: SubscribePayload) {
    await client.join(this.roomForSubmission(payload.submissionId));

    return {
      event: 'analysis.subscribed',
      submissionId: payload.submissionId,
    };
  }

  roomForSubmission(submissionId: string) {
    return `submission:${submissionId}`;
  }

  emitJobUpdate(submissionId: string, payload: Record<string, unknown>) {
    this.server?.to(this.roomForSubmission(submissionId)).emit(
      'analysis.update',
      {
        event: 'analysis.update',
        submissionId,
        ...payload,
      },
    );
  }
}
