
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Router ,ActivatedRoute} from '@angular/router';
import { CommonModule } from '@angular/common'; // 使用 @if 需要引入 CommonModule
import { FormsModule } from '@angular/forms';
// Angular Material 相關模組
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

// RxJS 相關操作符
import { delay } from 'rxjs/operators'; // <<< 引入 delay 操作符
import { TriggerAlertService } from '../@Services/trigger-alert.service';

// 您的服務
import { UsersServicesService,CkEmailIfExsit,msg } from '../@Services/users-services.service';
import { SocialAuthService, GoogleLoginProvider, SocialUser,GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { HttpClient } from '@angular/common/http'; // 引入 HttpClient 以便發送 HTTP 請求

import { HttpClientModule } from '@angular/common/http';
import { Subscription } from 'rxjs/internal/Subscription';

// 修正後的 CodeManager Class
class CodeManager {
  private code: string | null = null;
  private expirationTimer: any;

  generateCode(onExpired: () => void): string {
    this.code = Math.floor(100000 + Math.random() * 900000).toString();
    if (this.expirationTimer) { clearTimeout(this.expirationTimer); }
    this.expirationTimer = setTimeout(() => {
      console.log('CodeManager 內部的計時器時間到！');
      this.code = null;
      onExpired();
    }, 10 * 60 * 1000);
    return this.code;
  }

  // [修正] 將 console.log 移到 return 的前面
  isCodeValid(inputCode: string): boolean {
    console.log(`[CodeManager 內部] 正在比對... 使用者輸入: "${inputCode}", 內部儲存的碼: "${this.code}"`);
    return this.code !== null && this.code === inputCode;
  }

  public cancelTimer(): void {
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      console.log('一個舊的 CodeManager 計時器已被成功銷毀。');
    }
  }
}
@Component({
  selector: 'app-login',
  standalone: true, // 假設您的元件是 standalone
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    GoogleSigninButtonModule,
    HttpClientModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  // changeDetection: ChangeDetectionStrategy.OnPush // 可選
})
export class LoginComponent {

  constructor(
    private userService: UsersServicesService, // 注入 UserService
    private router: Router,
    private socialAuthService: SocialAuthService,
    private http: HttpClient,
    private triggerAlertService: TriggerAlertService,
    private route: ActivatedRoute
  ) {
    this.socialAuthService.authState.subscribe((user: SocialUser) => {
  if (user) {
    // 步驟一：保全 (Google) 驗證成功，我們拿到了 user 物件
    console.log('Google 登入成功!', user);

    // 步驟二 & 三：通知櫃檯 (您的後端 API)，並等待櫃檯核發場內通行證 (您自己的 JWT)
    this.userService.googlelogin(user.email, this.returnUrl).subscribe({
        next: (userVo) => {
            console.log('成功從自家後端取得 JWT 並完成登入', userVo);
        },
        error: (err) => {
            console.error('自家後端登入流程失敗', err);

            const errorMessage = err.error?.message || '登入失敗，請稍後再試或聯繫客服。';
            if (errorMessage === "使用者不存在" || errorMessage === "帳號或密碼錯誤" || errorMessage === "帳號不存在") {
            // 執行引導註冊的邏輯

            const googleUserData = {
                email: user.email,
                name: user.name,
                photo: user.photoUrl
            };
            localStorage.setItem('tempGoogleUser', JSON.stringify(googleUserData));
            this.userService.isgoogleornot = true;
            this.router.navigate(['/signup'], {
                queryParams: { source: 'google' }
            });
        } else {
            // 對於其他非預期的錯誤 (例如 "帳號已被停權" 等)，才顯示提示
            this.triggerAlertService.trigger(errorMessage, 'error', 4000);
        }}
    });
  }
});

      }

  private queryParamsSub: Subscription | undefined;
  returnUrl: string = '';
  isLoading: boolean = false;
  loginEmail = '';    // 用於儲存電子郵件輸入框的值
  loginPassword = ''; // 用於儲存密碼輸入框的值
  forget:boolean=false;
  ifsend:boolean=false;
  ckcode:boolean=false;
  mycode='';
  inputcode='';
  countdown = 0;
  timer: any;
  myusername='';
  timeover:boolean=false;
  newPassword='';
  activeCodeManager: CodeManager | null = null;
  hide = signal(true);


  ngOnInit() {
    // 在這裡可以獲取路由參數
    this.route.queryParams.subscribe(params => {
      this.returnUrl = params['returnUrl'] || '/main'; // 如果沒有 returnUrl，則默認導航到 /main
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSub?.unsubscribe();

  }

  clickEvent(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }


  testlogin(){
    this.userService.myemail="jason.wang@example.com"
    // this.userService.isLoggedInSubject.next(true);
    this.router.navigate(['/location']);

  }

  forgetpassword(){

    this.forget =true;
  }

  BackToLogin(){
    this.loginEmail='';
    this.loginPassword='';
    this.forget = false;
    this.ifsend=false;
    this.ckcode=false;
    if (this.activeCodeManager) {
        this.activeCodeManager.cancelTimer();
        this.activeCodeManager = null;
      }
  }

async sendCode(): Promise<void> {
  const baseUrl = 'http://localhost:8080/users';
  this.http
    .get<CkEmailIfExsit>(`${baseUrl}/checkEmailExists/${this.loginEmail}`)
      .subscribe({
      next:res => {
        if (res.code === 200) {
          this.triggerAlertService.trigger('此信箱不存在，請確認是否輸入正確或前往註冊', 'error');
        return;
        }else if(res.code == 400 && res.regularRegistration == true){
          this.triggerAlertService.trigger("您選擇的帳號當初是使用google登入，如忘記密碼請去該平台找回密碼","warning");
          this.BackToLogin();
          return;
        }else if(res.code == 400){
        this.ifsend=true;
        this.activeCodeManager = new CodeManager();
    const code = this.activeCodeManager.generateCode(() => {
    // 這個函式就是我們要給 CodeManager 的「通知任務」
    // 它會在 10 分鐘後被 CodeManager 自動呼叫
    console.log('LoginComponent 收到通知：驗證碼已過期！');

    // 在這裡更新 LoginComponent 自己的狀態
    this.timeover = true;

    // 你甚至可以在這裡觸發一個提示
    this.triggerAlertService.trigger('您先前申請的驗證碼已過期', 'warning');
  });
  console.log('產生的驗證碼:', code);
   const webhookUrl = 'https://middlen8n.servehttp.com/webhook/d272c705-d80b-4009-a75c-12c0a9614c00';
          this.http.post(webhookUrl, {
              email: this.loginEmail,
              code: code,
            }).subscribe({
              next: res => {
                this.triggerAlertService.trigger("寄送成功!請查看信箱","success")
                this.ifsend=true;
                this.ckcode=true;
                this.mycode=code;

              },
              error: err => {
                this.triggerAlertService.trigger("寄送失敗!請稍後重試","error")
                this.ifsend=false;
              },
              complete: () => console.log('🎉 呼叫完成'),
            });
        }
      },error: err => {
        console.error('checkEmail API 錯誤', err);
        this.triggerAlertService.trigger('伺服器發生錯誤，請稍後再試', 'error');
      },
    }
    )
}

  submitCode() {
  // 步驟一：檢查是否存在一個有效的 CodeManager 實例
  if (!this.activeCodeManager) {
    this.triggerAlertService.trigger('請先發送驗證碼。', 'error');
    return;
  }

  // 步驟二：檢查由回呼函式設定的「過期」標記
  if (this.timeover) {
    this.triggerAlertService.trigger('此驗證碼已過期！將重新寄一組新的驗證碼。', 'warning');
    this.sendcodeagain();
    this.timeover = false;
    return;
  }

  // 直接呼叫 activeCodeManager 的 isCodeValid 方法來進行驗證。
  if (this.activeCodeManager.isCodeValid(this.inputcode)) {
    // 驗證碼正確！執行重設密碼的後續動作
    this.updateUserPassword(this.loginEmail, this.newPassword);
}else{
  this.triggerAlertService.trigger("驗證碼錯誤!","error")
}
  }

 sendcodeagain(){
   if (this.countdown > 0) return; // 防止重複點擊
    this.countdown = 60;
    this.timer = setInterval(() => {
      this.countdown--;
      if (this.countdown === 0) {
        clearInterval(this.timer);
      }
    }, 1000);
    if (this.activeCodeManager) {
    this.activeCodeManager.cancelTimer();
  }
    this.activeCodeManager = new CodeManager();
    const code = this.activeCodeManager.generateCode(() => {
    // 這個函式就是我們要給 CodeManager 的「通知任務」
    // 它會在 10 分鐘後被 CodeManager 自動呼叫
    console.log('LoginComponent 收到通知：驗證碼已過期！');

    // 在這裡更新 LoginComponent 自己的狀態
    this.timeover = true;

    // 你甚至可以在這裡觸發一個提示
    this.triggerAlertService.trigger('您先前申請的驗證碼已過期', 'warning');
  });
  console.log('產生的驗證碼:', code);
   const webhookUrl = 'https://middlen8n.servehttp.com/webhook/d272c705-d80b-4009-a75c-12c0a9614c00';
          this.http.post(webhookUrl, {
              email: this.loginEmail,
              code: code,
            }).subscribe({
              next: res => {
                this.triggerAlertService.trigger("寄送成功!請查看信箱","success")
                this.ifsend=true;
                this.ckcode=true;
                this.timeover=false;
                this.mycode=code;
              },
              error: err => {
                this.triggerAlertService.trigger("寄送失敗!請稍後重試","error")
                this.ifsend=false;
              },
              complete: () => console.log('🎉 呼叫完成'),
            });
 }
  signInWithGoogle(): void {
    // 呼叫函式庫提供的登入方法，它會自動處理彈出視窗等流程
    this.socialAuthService.signIn(GoogleLoginProvider.PROVIDER_ID);
  }

  signup(){
    this.userService.isgoogleornot=false;
    this.router.navigate(['/signup'], { queryParams: { returnUrl: this.returnUrl } });
  }

  LoginCheck() {
    if (!this.loginEmail || !this.loginPassword) {
      this.triggerAlertService.trigger('電子信箱或密碼請勿空白！', "error");
      return;
    }

    // 【修改點 1】: 在發起請求前，立刻設定 isLoading 為 true，顯示讀取動畫
    this.isLoading = true;

    // 【修改點 2】: 呼叫 service 方法並「訂閱」它
    this.userService.login(this.loginEmail, this.loginPassword, this.returnUrl)
      .subscribe({
        // next 會在請求成功且 tap 中沒有拋出錯誤時執行
        // 因為所有成功邏輯（導航、提示）都在 Service 的 tap 中做完了，這裡可以留空
        next: (response) => {
          console.log('登入流程處理完畢', response);
          // 成功的載入結束會在導航後自然消失，但如果沒有導航，可以在此處設定
          // this.isLoading = false;
        },
        // error 會在請求失敗 (網路錯誤、後端500) 或 tap 中拋出錯誤時執行
        error: (err) => {
          console.error('Login Component 收到錯誤通知', err);
          // 【修改點 3】: 不論成功失敗，最終都要結束讀取狀態
          this.isLoading = false;
        },
        // complete 會在 Observable 成功結束時執行
        complete: () => {
           console.log('Login Observable 已完成。');
           // 【修改點 3】: 不論成功失敗，最終都要結束讀取狀態
           this.isLoading = false;
        }
      });
  }
updateUserPassword(email: string, passwordHash: string):void{
  const baseUrl = 'http://localhost:8080/users';
  this.http
  .post<msg>(`${baseUrl}/update`,{ email, passwordHash })
      .subscribe({
      next:res => {
        if (res.code === 200) {
          this.triggerAlertService.trigger('密碼已成功重設！請使用新密碼登入。', 'success', 4000);
          this.inputcode='';
          this.mycode='';
           this.loginEmail='';
    this.loginPassword='';
    this.forget = false;
    this.ifsend=false;
    this.ckcode=false;
      if (this.activeCodeManager) {
        this.activeCodeManager.cancelTimer();
        this.activeCodeManager = null;
      }
        return;
        }else{
          this.triggerAlertService.trigger(res.message,"warning");
          return;
        }
      },error: err => {
        console.error('checkEmail API 錯誤', err);
        this.triggerAlertService.trigger('伺服器發生錯誤，請稍後再試', 'error');
    }
  }
    )
  const userToUpdate = this.userService.AccountData.find(u => u.email === email);
}
}
