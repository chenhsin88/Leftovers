import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { UsersServicesService } from './users-services.service';

// 定義從 AI 後端收到的回應格式
export interface AiResponse {
  reply: string;
  conversation_id: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiChatService {
  private aiServiceUrl = 'http://localhost:8082/recommend'; // 你的 Python AI 服務 URL
  private conversationId: string | null = null;

  constructor(
    private http: HttpClient,
    private userService: UsersServicesService
  ) { }

  public sendMessage(
    query: string,
    userEmail: string,
    userLat?: number,
    userLng?: number
  ): Observable<AiResponse> {

    const accessToken = this.userService.getAccessToken();
    if (!accessToken) {
      return throwError(() => new Error('無法發送訊息：使用者未登入或 Token 無效。'));
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    });

    const body = {
      query,
      conversation_id: this.conversationId,
      user_email: userEmail,
      user_lat: userLat,
      user_lng: userLng
    };

    return this.http.post<AiResponse>(this.aiServiceUrl, body, { headers }).pipe(
      tap(response => {
        // 從 AI 的回應中取得並儲存 conversation_id，供下一次請求使用
        if (response && response.conversation_id) {
          this.conversationId = response.conversation_id;
        }
      }),
      catchError(error => {
        console.error('與 AI 服務溝通時發生錯誤:', error);
        return throwError(() => new Error('抱歉，AI 助理目前無法連線。'));
      })
    );
  }

  // 提供一個方法來重設對話，例如當使用者登出時
  public resetConversation(): void {
    this.conversationId = null;
  }
}
