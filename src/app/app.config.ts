import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { UsersServicesService } from './@Services/users-services.service';
import { Observable } from 'rxjs';
import {
  GoogleLoginProvider,
  SocialAuthServiceConfig,
} from '@abacritt/angularx-social-login';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'; // 引入 withInterceptorsFromDi
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './@Services/auth.interceptor';
function initializeAppFactory(userService: UsersServicesService): () => Observable<any> {
  return () => userService.populateAuthStateOnLoad();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()), // 啟用依賴注入的 Interceptor
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },

    // SocialAuthServiceConfig 的設定物件
    {
      provide: 'SocialAuthServiceConfig',
      useValue: {
        autoLogin: false,
        providers: [
          // 這個陣列只應該包含登入提供商
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider(
              '271560522339-vabfq3v2e011ik69fd6u4ab4iv66f39h.apps.googleusercontent.com'
            ),
          },
          // ▼▼▼ 錯誤的 APP_INITIALIZER 設定已從此處移除 ▼▼▼
        ],
        onError: (err) => {
          console.error('Google Login Error:', err);
        },
      } as SocialAuthServiceConfig,
    }, // SocialAuthServiceConfig 物件到此結束

    // ▼▼▼ APP_INITIALIZER 應該放在這裡，與上面的物件平級 ▼▼▼
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAppFactory,
      deps: [UsersServicesService],
      multi: true,
    },
  ],
};
