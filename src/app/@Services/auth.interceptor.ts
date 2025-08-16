// in: src/app/@Services/auth.interceptor.ts

import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { UsersServicesService } from './users-services.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(private userService: UsersServicesService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const accessToken = this.userService.getAccessToken();
    let apiReq = request.clone(); // 建立一個可修改的副本

    // 1. 只針對我們自己的後端 API 進行處理
    if (request.url.startsWith('http://localhost:8080')) {
      // 2. ★★★ 無論如何，都先加上 withCredentials: true ★★★
      //    這確保了 refresh token cookie 能被送到後端
      apiReq = request.clone({
        withCredentials: true
      });

      // 3. 如果有 access token，再把 Authorization 標頭加上去
      if (accessToken) {
        apiReq = this.addTokenHeader(apiReq, accessToken);
      }
    }

    // 2. 處理請求的回應
    return next.handle(apiReq).pipe(catchError(error => {
      // 3. 只處理 401 錯誤，且確保出錯的不是 /refresh API 本身
        if (error instanceof HttpErrorResponse && error.status === 401 && !apiReq.url.includes('/login') && !apiReq.url.includes('/refresh')) {
    return this.handle401Error(apiReq, next);
  }
      return throwError(() => error);
    }));
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler) {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      // 4. 呼叫 Service 的 refreshToken 方法來「自動續命」
      return this.userService.refreshToken().pipe(
        switchMap((response: any) => {
          this.isRefreshing = false;
          // 將新的 token 廣播給其他等待中的請求
          this.refreshTokenSubject.next(response.accessToken);

          // 5. 用新的 Token 重新發送一次原本失敗的請求
          console.log('Token 刷新成功，正在用新 Token 重試請求...');
          return next.handle(this.addTokenHeader(request, response.accessToken));
        }),
        catchError((err) => {
          this.isRefreshing = false;
          // 6. 如果連「續命」都失敗了（例如 Refresh Token 也過期了），才強制登出
          console.error('刷新 Token 失敗，執行強制登出。');
          this.userService.LoginOutNow();
          return throwError(() => err);
        })
      );
    }

    // 如果剛好有其他 API 請求也在「續命」期間發生，
    // 就讓它先等等，直到拿到新 Token 後再一起發送。
    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(jwt => next.handle(this.addTokenHeader(request, jwt)))
    );
  }

  private addTokenHeader(request: HttpRequest<any>, token: string) {
    // 如果是刷新 Token 的請求，就不需要攜帶舊的、已過期的 Token
    if (request.url.includes('/refresh')) {
        return request;
    }
    // 對於其他所有請求，才加上 Authorization 標頭
    return request.clone({ headers: request.headers.set('Authorization', `Bearer ${token}`) });
  }
}
