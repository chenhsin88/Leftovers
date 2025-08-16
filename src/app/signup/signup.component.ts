import { TriggerAlertService } from './../@Services/trigger-alert.service';
import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef,HostListener  } from '@angular/core';
import { FormsModule } from '@angular/forms'; // 引入 FormsModule 以使用 ngModel
import { UsersServicesService, NewUserLogin,CkEmailIfExsit} from '../@Services/users-services.service';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Router ,ActivatedRoute} from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CanComponentDeactivate } from '../@Services/can-deactivate.guard';
import { MatInputModule } from '@angular/material/input';

import { ChangeDetectionStrategy, signal } from '@angular/core';

import { HttpClient } from '@angular/common/http'; // 引入 HttpClient 以便發送 HTTP 請求

import { HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// --- CodeManager Class ---
class CodeManager {
  private code: string | null = null;
  private expirationTimer: any;
  public IsExpiredOrNot: boolean = false;


  generateCode(): string {
    this.code = Math.floor(100000 + Math.random() * 900000).toString();
    this.IsExpiredOrNot = false;
    if (this.expirationTimer) { clearTimeout(this.expirationTimer); }
    this.expirationTimer = setTimeout(() => {
      console.log('驗證碼已過期');
      this.code = null;
      this.IsExpiredOrNot = true;
    }, 10 * 60 * 1000); // 10 分鐘
    return this.code;
  }

  isCodeValid(inputCode: string): boolean {
    return this.code !== null && this.code === inputCode;
    console.log(`驗證碼 ${inputCode}`);

  }
}

// --- ChatMessage Interface ---
interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  isLoading?: boolean;
  showTimer?: boolean; // <<< 修正拼寫：Showtimer -> showTimer
  type?: 'normal' | 'avatar'; // 新增欄位
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
   HttpClientModule],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent implements OnInit, AfterViewInit, OnDestroy, CanComponentDeactivate {
  messages: ChatMessage[] = [];
  userInput: string = '';
  currentQuestionId: number = 0;
  newconter: number = 0;
  IsokToType: boolean = false;
  showAvatarUploadUI: boolean = false; // 用於切換 UI
  private selectedFile: File | null = null; // 用於儲存使用者選擇的檔案
  avatarPreviewUrl: string | ArrayBuffer | null = null;// 新增一個屬性來儲存 Base64 結果，方便預覽

  private registrationData: NewUserLogin= {
    email: '',
    passwordHash: '',
    name: '',
    phoneNumber: '',
    profilePictureUrl:'',
    role: 'customer',
    isActive: true,// 預設啟用帳號
    regularRegistration:false,
  };

  countdownMinutes: number = 10;
  countdownSeconds: number = 0;
  private countdownInterval: any;
  private codeManager = new CodeManager();
  private isModifying: boolean = false;
  photoopen : boolean =false;
  emailinputshow : boolean = false;
  passwordinputshow : boolean = false;
  newemail : string = "";
  havephoto :boolean = false;
  isfirstphotoupdate : boolean =false;
  google:boolean=false;

  private returnUrl: string = '';

  @ViewChild('messageContainer') private messageContainer!: ElementRef;

  hide = signal(true);

  constructor(
    private http: HttpClient,
    private router: Router,
    private userService: UsersServicesService,
    private TriggerAlertService:TriggerAlertService,
    private route: ActivatedRoute,
  ) {}

   canDeactivate(): boolean {
    // 判斷邏輯：
    // 1. 如果對話流程還沒結束 (currentQuestionId 不是 99)
    // 2. 且使用者已經輸入了一些資料 (例如 email 或 name 欄位不是空的)
    // 就跳出確認視窗。
    if (this.currentQuestionId !== 99 && !!this.registrationData.email ) {
      // 使用瀏覽器內建的 confirm 對話框
      return confirm('您有未完成的註冊資料，確定要離開嗎？所有進度將會遺失！');
    }

    // 如果不符合上述條件 (例如已經註冊成功，或根本還沒開始填)，就直接允許離開。
    return true;
  }
   /**
   * 監聽瀏覽器的 beforeunload 事件
   * @param event - 瀏覽器事件物件
   */
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    console.log('偵測到頁面即將刷新或關閉 (beforeunload event triggered!)');
    // 檢查的條件與 canDeactivate 方法中的完全相同
    const shouldPreventUnload = (this.currentQuestionId !== 99 && !!this.registrationData.email);
     console.log('是否應該阻止離開頁面 (shouldPreventUnload):', shouldPreventUnload);

  // 如果判斷結果為 true，才執行阻止的動作
  if (shouldPreventUnload) {
    // 【修改點】: 這是目前最推薦、相容性較好的標準寫法
    $event.preventDefault();
    $event.returnValue = ''; // 在現代瀏覽器中，賦予一個空字串即可觸發提示
  }

  }

  addAvatarPreviewMessage(): void {
  const avatarMessage: ChatMessage = {
    sender: 'bot',
    text: '您選擇的頭像是:',
    timestamp: new Date(),
    isLoading: false,
    showTimer: false,
    type: 'avatar'
  };
  this.messages.push(avatarMessage);
  this.scrollToBottomAfterRender();
}

  clickEvent(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }

  ngOnInit(): void {

    if (this.userService.isgoogleornot) {
      // 這是 Google 註冊流程
      this.registrationData.regularRegistration = true;

      // ★ 從 localStorage 還原 Google 使用者資料
      const storedData = localStorage.getItem('tempGoogleUser');
      if (storedData) {
        const googleUser = JSON.parse(storedData);
        this.registrationData.email = googleUser.email;
        this.registrationData.name = googleUser.name;
        if (googleUser.photo) {
          this.registrationData.profilePictureUrl = googleUser.photo;
          this.avatarPreviewUrl = googleUser.photo;
        }
      }
    } else {
      // 這是一般註冊流程
      this.registrationData.regularRegistration = false;
    }
    // if(this.userService.isgoogleornot){
    //   this.registrationData.email=this.userService.myemail;
    //   this.registrationData.name=this.userService.myname;
    //   this.registrationData.regularRegistration=true;
    // }else{
    //   this.registrationData.regularRegistration=false;
    // }
    this.showWelcomeSequence();
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '';
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  startCountdown(minutes: number): void {
    let totalSeconds = minutes * 60;
    if (this.countdownInterval) { clearInterval(this.countdownInterval); }

    this.countdownMinutes = Math.floor(totalSeconds / 60);
    this.countdownSeconds = totalSeconds % 60;

    this.countdownInterval = setInterval(() => {
      totalSeconds--;
      this.countdownMinutes = Math.floor(totalSeconds / 60);
      this.countdownSeconds = totalSeconds % 60;
      if (totalSeconds <= 0) {
        clearInterval(this.countdownInterval);
      }
    }, 1000);
  }

  addBotMessage(text: string, options: { isLoading?: boolean; showTimer?: boolean } = {}): void {
    const botMessage: ChatMessage = {
      sender: 'bot',
      text: text,
      timestamp: new Date(),
      isLoading: options.isLoading ?? false,
      showTimer: options.showTimer ?? false
    };
    this.messages.push(botMessage);
    this.scrollToBottomAfterRender();
  }

  addUserMessage(text: string): void {
    const userMessage: ChatMessage = {
      sender: 'user',
      text: text,
      timestamp: new Date()
    };
    this.messages.push(userMessage);
    this.scrollToBottomAfterRender();
  }

 // sendMessage 現在也變成 async
  async sendMessage(): Promise<void> {
    if (!this.userInput.trim() || !this.IsokToType) { return; }

    const userText = this.userInput;
    this.addUserMessage(userText);
    this.userInput = '';
    this.IsokToType = false; // 送出後立即禁止輸入

    // 直接 await 機器人回覆的完整流程
    await this.processBotReply(userText);
  }

  // processBotReply 現在是 async，會完整處理一次對話的回覆流程
  async processBotReply(userText: string): Promise<void> {
    const lowerCaseText = userText.toLowerCase();

    // 每次機器人要回覆時，都先顯示「輸入中」動畫
    this.addBotMessage('', { isLoading: true });
    await delay(1200); // 模擬思考時間
    this.messages.pop(); // 移除「輸入中」

    // 執行對話邏輯
    switch (this.currentQuestionId) {
      case 1: // 處理使用者輸入的 Email

      console.log(this.emailinputshow);

        if (userText.includes('@')) {
            this.http
              .get<CkEmailIfExsit>(`http://localhost:8080/users/checkEmailExists/${userText}`)
                .subscribe({
                next:async res => {
                  if (res.code === 200) {
                  }else if(res.code == 400 && res.regularRegistration == true){
                    await this.showTypingThenMessage("抱歉，這個電子信箱已經被使用或是使用過Google登入，請使用其他的電子信箱，或是返回登入頁面");
                    return;
                }}})
          this.addBotMessage(`好的，您輸入的 email 是「${userText}」`);
          await this.showTypingThenMessage("正在為您發送驗證碼，請稍候...");
          this.IsokToType = true;
          this.registrationData.email = userText;
          const newCode = this.codeManager.generateCode();
          console.log(`產生的驗證碼是: ${newCode}`);
          const webhookUrl = 'https://middlen8n.servehttp.com/webhook/41a43605-595b-4e43-89af-1a4499a6b26a';
          this.http.post(webhookUrl, {
    email: this.registrationData.email,
    code: newCode,
}).subscribe({
    next: async (res: any) => { // 加上 async 關鍵字，因為要用 await
        console.log('✅ Webhook 成功：', res);

        // --- 把你的判斷邏輯搬到這裡 ---
        if (res.status === "success") {
            // 成功訊息，附加上 email
            await this.showTypingThenMessage(`${res.message} ${this.registrationData.email}`);
            // 成功後才去問下一個問題 (驗證碼)
            this.emailinputshow = false;
            await this.emailcheckedSequence();
        } else if (res.status === "error") {
            // 顯示 n8n 回傳的錯誤訊息
            await this.showTypingThenMessage("該信箱格式錯誤或是不存在，請重新輸入");
            // 流程重置，讓使用者重新輸入 Email
            this.currentQuestionId = 1;
            // 這裡的 break 不能用，因為不在 switch 的直接層級下
            // break; <-- 要移除
        } else {
            // 未知的錯誤
            await this.showTypingThenMessage("發生未知錯誤，請聯絡客服");
            this.currentQuestionId = 1;
            // break; <-- 要移除
        }
    },
    error: async (err) => { // 加上 async
        console.error('❌ Webhook 失敗：', err);
        // 這裡處理網路錯誤、n8n掛掉等問題
        await this.showTypingThenMessage("無法連接至伺服器，請稍後再試");
        this.currentQuestionId = 1; // 同樣重置流程
    },
    complete: () => console.log('🎉 呼叫完成'),
});}
  break;
      case 2: // 處理使用者輸入的驗證碼
        if (userText.trim() === '1') {
          this.IsokToType = false; // 禁止輸入
          this.addBotMessage("您已選擇重設電子信箱，請重新輸入您的電子信箱");
          this.currentQuestionId = 1; // 重置到第一個問題
          this.emailinputshow =true;
          this.registrationData.email = ''; // 清除之前的電子信箱
          this.codeManager = new CodeManager(); // 重置驗證碼管理器
          this.IsokToType = true; // 允許重新輸入
          break;
          }
        if(userText.trim() === '') {
          this.IsokToType = false; // 禁止輸入
          this.addBotMessage("驗證碼不得為空，請重新輸入");
          this.IsokToType = true; // 允許重新輸入
          break;

        }
        if(userText.trim() === "2"){
          this.IsokToType = false; // 禁止輸入
          this.addBotMessage("您已選擇重新發送驗證碼，請稍候...");

          const newCode = this.codeManager.generateCode(); // 重新產生驗證碼
          console.log(`重新產生的驗證碼是: ${newCode}`);
          const webhookUrl = 'https://middlen8n.servehttp.com/webhook/41a43605-595b-4e43-89af-1a4499a6b26a';
          this.http.post(webhookUrl, { email: this.registrationData.email, code: newCode }).subscribe({
    next: async (res: any) => { // 加上 async 關鍵字，因為要用 await
        console.log('✅ Webhook 成功：', res);

        // --- 把你的判斷邏輯搬到這裡 ---
        if (res.status === "success") {
            // 成功訊息，附加上 email
            await this.showTypingThenMessage(`${res.message} ${this.registrationData.email}`);
            // 成功後才去問下一個問題 (驗證碼)
            this.emailinputshow = false;
            await this.emailcheckedSequence();
        } else if (res.status === "error") {
            // 顯示 n8n 回傳的錯誤訊息
            await this.showTypingThenMessage(res.message);
            // 流程重置，讓使用者重新輸入 Email
            this.currentQuestionId = 1;
            // 這裡的 break 不能用，因為不在 switch 的直接層級下
            // break; <-- 要移除
        } else {
            // 未知的錯誤
            await this.showTypingThenMessage("發生未知錯誤，請聯絡客服");
            this.currentQuestionId = 1;
            // break; <-- 要移除
        }
    },
    error: async (err) => { // 加上 async
        console.error('❌ Webhook 失敗：', err);
        // 這裡處理網路錯誤、n8n掛掉等問題
        await this.showTypingThenMessage("無法連接至伺服器，請稍後再試");
        this.currentQuestionId = 1; // 同樣重置流程
    },
    complete: () => console.log('🎉 呼叫完成'),
});;
          this.IsokToType = true; // 允許重新輸入
          break;
        }
        if (this.codeManager.IsExpiredOrNot) {
          if (this.countdownInterval) { clearInterval(this.countdownInterval); }
          this.IsokToType = false; // 禁止輸入
          this.addBotMessage("驗證碼已過期，將重新開始流程");
          this.currentQuestionId = 0;
          await this.showWelcomeSequence();
        } else if (this.codeManager.isCodeValid(userText)) {
          if (this.countdownInterval) { clearInterval(this.countdownInterval); }

          await this.showTypingThenMessage("驗證碼正確！");
          await this.passwordcheckedSequence();
        } else {
          this.addBotMessage("驗證碼錯誤，請重新輸入。");
          this.IsokToType = true;
        }
        break;

      case 3: // 處理使用者輸入的密碼
        this.IsokToType = false; // 禁止輸入
        this.passwordinputshow = true;
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,16}$/;
        if (passwordRegex.test(userText)) {
          this.registrationData.passwordHash = userText;
          this.addBotMessage("密碼格式正確！感謝您，正在為您建立帳號...");
          this.passwordinputshow = false;
          await this.typecheckedSequence();

        } else {
          this.addBotMessage("抱歉，密碼格式不符合要求（6-16位，需含大小寫英文及數字），請再試一次。");
          this.IsokToType = true;
        }
        break;
      case 4: // 完成註冊流程
         if (userText.trim() === '1') {
          await this.showTypingThenMessage("您選擇了一般使用者身分。");

          this.registrationData.role = 'customer';
          await this.usernamecheckedSequence(); // 提問使用者名稱
        } else if (userText.trim() === '2') {
          await this.showTypingThenMessage("您選擇了店家使用者身分。");
          this.registrationData.role = 'merchants';
          await this.usernamecheckedSequence(); // 提問店家名稱
        } else {
          await this.showTypingThenMessage("請輸入「1」或「2」來選擇您的身分。");
          this.IsokToType = true; // 讓使用者可以重新輸入
        }

        break;

      case 5:
          if (userText.trim() === '') {
            this.IsokToType = false; // 禁止輸入
            this.addBotMessage("名稱不得為空，請重新輸入");
            this.IsokToType = true;
          } else {
            this.IsokToType = false; // 禁止輸入
            this.addBotMessage(`您選擇的名稱是「${userText}」`);
            this.registrationData.name=userText;
            await this.phonecheckedSequence();
          }
        break;

      case 6:
        const phoneRegex = /^09\d{8}$/;
        if (phoneRegex.test(userText)) {
          this.IsokToType = false; // 禁止輸入
          this.addBotMessage(`您的電話號碼是「${userText}」`);
          this.registrationData.phoneNumber = userText;
          await this.userphotocheckedSequence();
        } else {
          this.IsokToType = false; // 禁止輸入
          this.addBotMessage("抱歉，電話號碼格式不正確，請再試一次");
          this.IsokToType = true;
        }
        break;

      case 7:
        this.photoopen = true;
        this.IsokToType = true;
          this.addBotMessage("請選擇「選擇頭像」來上傳頭像，或是「不選擇頭像」來跳過選擇");
          this.IsokToType = true; // 讓使用者可以重新輸入

        break;

      case 8: // 處理頭像上傳確認
         const input = userText.trim();

  // 👉 第一次輸入：使用者輸入數字選擇要改什麼
  if (this.newconter === 0) {
    const num = Number(input);
    if(!this.userService.isgoogleornot){
      if (num >= 1 && num <= 7) {
      //   if (num === 1) {
      //   // ✅ 直接處理註冊成功邏輯
      //   this.IsokToType = false;
      //   await this.showTypingThenMessage("註冊成功！");
      //   await this.userService.findrole(this.registrationData.email);

      //   if (this.userService.userRole === "customer") {
      //     this.router.navigate(['/main']);
      //   } else if (this.userService.userRole === "admin") {
      //     this.userService.isgoogleornot = false;
      //   }

      //   console.log(this.registrationData);
      //   return; // ✅ 不要再往後執行
      // }
        this.newconter = num;
        switch (num) {
          // case 1:
          //   break;
          case 1:
            this.IsokToType=false;

          this.showTypingThenMessage("正在註冊請稍後...");
          this.currentQuestionId = 99;
         this.userService.AccountDataRegister(this.registrationData).subscribe({
  next: res => {
    // 註冊成功後，不要手動操作任何 service 裡的變數
    this.showTypingThenMessage("註冊成功!! 正在為您自動登入...");
    console.log('後端註冊成功:', res);
    // ★ 步驟二：從註冊資料中取得 email 和密碼，準備登入
    const email = this.registrationData.email;
    const password = this.registrationData.passwordHash;

    // 如果是 Google 註冊，則沒有密碼，呼叫 googlelogin 方法
    if (this.registrationData.regularRegistration) {
      this.userService.googlelogin(email,this.returnUrl).subscribe({
        next: userVo => {
          // 登入成功！Service 內部會自動處理導航，這裡什麼都不用做。
          console.log('註冊後自動 Google 登入成功，導航將自動進行。使用者:', userVo);
        },
        error: loginErr => {
          // 如果自動登入失敗，引導使用者去手動登入
          console.error('註冊後自動 Google 登入失敗:', loginErr);
          this.TriggerAlertService.trigger("自動登入失敗，請前往登入頁面手動嘗試。", "warning", 5000);
          this.router.navigate(['/login']);
        }
      });
    } else {
      if(this.registrationData.regularRegistration){
        this.userService.googlelogin(email,this.returnUrl).subscribe({
          next: userVo => {
            // 登入成功！Service 內部會自動處理導航，這裡什麼都不用做。
            console.log('註冊後自動 Google 登入成功，導航將自動進行。使用者:', userVo);
          },
          error: loginErr => {
            // 如果自動登入失敗，引導使用者去手動登入
            console.error('註冊後自動 Google 登入失敗:', loginErr);
            this.TriggerAlertService.trigger("自動登入失敗，請前往登入頁面手動嘗試。", "warning", 5000);
            this.router.navigate(['/login']);
          }
        });
      }else{
        // 如果是一般註冊，呼叫含密碼的 login 方法
        this.userService.login(email, password,this.returnUrl).subscribe({
          next: userVo => {
            // 登入成功！Service 內部會自動處理導航，這裡什麼都不用做。
            console.log('註冊後自動登入成功，導航將自動進行。使用者:', userVo);
        },
        error: loginErr => {
          // 如果自動登入失敗，引導使用者去手動登入
          console.error('註冊後自動登入失敗:', loginErr);
          this.TriggerAlertService.trigger("自動登入失敗，請前往登入頁面手動嘗試。", "warning", 5000);
          this.router.navigate(['/login']);
          }
      });
    }
  }
}, // <--- 在這裡加上逗號！
error: err => {
  this.showTypingThenMessage("註冊失敗，請聯絡客服")
  console.error('後端註冊失敗:', err); // 建議在 log 中加入更明確的訊息
  // 這裡不需要 return，因為箭頭函式預設會返回 undefined
}
});

// 在呼叫 subscribe 之後，就可以結束 switch case
break;
        case 2:
            await this.showTypingThenMessage("請輸入新的電子信箱：");
            this.emailinputshow = true;
            break;
          case 3:
            await this.showTypingThenMessage("請輸入新的密碼：");
            this.passwordinputshow = true;
            break;
          case 4:
            await this.showTypingThenMessage("請輸入新的使用者名稱：");
            break;
          case 5:
            await this.showTypingThenMessage("請輸入新的電話號碼：");
            break;
          case 6:
            await this.showTypingThenMessage("請重新上傳頭像：");
            this.photoopen=true;
            this.showAvatarUploadUI=false;
            break;
          case 7:
            await this.showTypingThenMessage("請重新選擇您的身分：");
            await this.showTypingThenMessage("輸入「1」為一般使用者，輸入「2」為店家使用者");
            break;
        }

      this.IsokToType = true;
    } else {
      await this.showTypingThenMessage("請輸入 1 到 7 之間的數字。");
      this.IsokToType = true;
    }
    break;
  }
    else{
      if (num >= 1 && num <= 5) {
        if(num==1){
           this.IsokToType=false;
           this.currentQuestionId = 99;
          this.showTypingThenMessage("正在註冊請稍後...");

         this.userService.AccountDataRegister(this.registrationData).subscribe({
  next: res => {
    // 註冊成功後，不要手動操作任何 service 裡的變數
    this.showTypingThenMessage("註冊成功!! 正在為您自動登入...");
    console.log('後端註冊成功:', res);
    // ★ 步驟二：從註冊資料中取得 email 和密碼，準備登入
    const email = this.registrationData.email;
    const password = this.registrationData.passwordHash;

    // 如果是 Google 註冊，則沒有密碼，呼叫 googlelogin 方法
    if (this.registrationData.regularRegistration) {
      this.userService.googlelogin(email, this.returnUrl).subscribe({
        next: userVo => {
          // 登入成功！Service 內部會自動處理導航，這裡什麼都不用做。
          console.log('註冊後自動 Google 登入成功，導航將自動進行。使用者:', userVo);
        },
        error: loginErr => {
          // 如果自動登入失敗，引導使用者去手動登入
          console.error('註冊後自動 Google 登入失敗:', loginErr);
          this.TriggerAlertService.trigger("自動登入失敗，請前往登入頁面手動嘗試。", "warning", 5000);
          this.router.navigate(['/login']);
        }
      });
    } else {
      if(this.registrationData.regularRegistration){
        this.userService.googlelogin(email,this.returnUrl).subscribe({
          next: userVo => {
            // 登入成功！Service 內部會自動處理導航，這裡什麼都不用做。
            console.log('註冊後自動 Google 登入成功，導航將自動進行。使用者:', userVo);
          },
          error: loginErr => {
            // 如果自動登入失敗，引導使用者去手動登入
            console.error('註冊後自動 Google 登入失敗:', loginErr);
            this.TriggerAlertService.trigger("自動登入失敗，請前往登入頁面手動嘗試。", "warning", 5000);
            this.router.navigate(['/login']);
          }
        });
      }else{
        // 如果是一般註冊，呼叫含密碼的 login 方法
        this.userService.login(email, password,this.returnUrl).subscribe({
          next: userVo => {
            // 登入成功！Service 內部會自動處理導航，這裡什麼都不用做。
            console.log('註冊後自動登入成功，導航將自動進行。使用者:', userVo);
        },
        error: loginErr => {
          // 如果自動登入失敗，引導使用者去手動登入
          console.error('註冊後自動登入失敗:', loginErr);
          this.TriggerAlertService.trigger("自動登入失敗，請前往登入頁面手動嘗試。", "warning", 5000);
          this.router.navigate(['/login']);
          }
      });
    }
  }
}, // <--- 在這裡加上逗號！
error: err => {
  this.showTypingThenMessage("註冊失敗，請聯絡客服")
  console.error('後端註冊失敗:', err); // 建議在 log 中加入更明確的訊息
  // 這裡不需要 return，因為箭頭函式預設會返回 undefined
}
});

// 在呼叫 subscribe 之後，就可以結束 switch case
break;
        }else{
        this.newconter = num+2;
        }
        switch (num) {
          case 1:
            break;
          case 2:
            await this.showTypingThenMessage("請輸入新的使用者名稱：");
            break;
          case 3:
            await this.showTypingThenMessage("請輸入新的電話號碼(須為09開頭)且共10碼：");
            break;
          case 4:
            await this.showTypingThenMessage("請重新上傳頭像：");
            this.photoopen=true;
            this.showAvatarUploadUI=false;
            break;
          case 5:
            await this.showTypingThenMessage("請重新選擇您的身分：");
            await this.showTypingThenMessage("輸入「1」來修改一般身分或是輸入「2」成為店家身分");
            break;
        }

      this.IsokToType = true;
    } else {
      await this.showTypingThenMessage("請輸入 1 到 5 之間的數字。");
      this.IsokToType = true;
    }
    break;
    }
  }
        this.isModifying = true; // 假設使用者要修改，除非他們輸入 '1'
        switch (this.newconter) {
          case 1: // 確認註冊

            this.isModifying = false; // 取消修改狀態
            await this.showTypingThenMessage("感謝您的確認！正在為您完成最後的註冊步驟...");
            // 在這裡呼叫您的 userService 來提交 this.registrationData
              this.userService.AccountDataRegister(this.registrationData).subscribe({
  next: res => {
    // 註冊成功後，不要手動操作任何 service 裡的變數
    this.showTypingThenMessage("註冊成功!! 正在為您自動登入...");
    console.log('後端註冊成功:', res);
    // ★ 步驟二：從註冊資料中取得 email 和密碼，準備登入
    const email = this.registrationData.email;
    const password = this.registrationData.passwordHash;

    // 如果是 Google 註冊，則沒有密碼，呼叫 googlelogin 方法
    if (this.registrationData.regularRegistration) {
      this.userService.googlelogin(email,this.returnUrl).subscribe({
        next: userVo => {
          // 登入成功！Service 內部會自動處理導航，這裡什麼都不用做。
          console.log('註冊後自動 Google 登入成功，導航將自動進行。使用者:', userVo);
        },
        error: loginErr => {
          // 如果自動登入失敗，引導使用者去手動登入
          console.error('註冊後自動 Google 登入失敗:', loginErr);
          this.TriggerAlertService.trigger("自動登入失敗，請前往登入頁面手動嘗試。", "warning", 5000);
          this.router.navigate(['/login']);
        }
      });
    } else {
      if(this.registrationData.regularRegistration){
        this.userService.googlelogin(email,this.returnUrl).subscribe({
          next: userVo => {
            // 登入成功！Service 內部會自動處理導航，這裡什麼都不用做。
            console.log('註冊後自動 Google 登入成功，導航將自動進行。使用者:', userVo);
          },
          error: loginErr => {
            // 如果自動登入失敗，引導使用者去手動登入
            console.error('註冊後自動 Google 登入失敗:', loginErr);
            this.TriggerAlertService.trigger("自動登入失敗，請前往登入頁面手動嘗試。", "warning", 5000);
            this.router.navigate(['/login']);
          }
        });
      }else{
        // 如果是一般註冊，呼叫含密碼的 login 方法
        this.userService.login(email, password,this.returnUrl).subscribe({
          next: userVo => {
            // 登入成功！Service 內部會自動處理導航，這裡什麼都不用做。
            console.log('註冊後自動登入成功，導航將自動進行。使用者:', userVo);
        },
        error: loginErr => {
          // 如果自動登入失敗，引導使用者去手動登入
          console.error('註冊後自動登入失敗:', loginErr);
          this.TriggerAlertService.trigger("自動登入失敗，請前往登入頁面手動嘗試。", "warning", 5000);
          this.router.navigate(['/login']);
          }
      });
    }
  }
}, // <--- 在這裡加上逗號！
error: err => {
  this.showTypingThenMessage("註冊失敗，請聯絡客服")
  console.error('後端註冊失敗:', err); // 建議在 log 中加入更明確的訊息
  // 這裡不需要 return，因為箭頭函式預設會返回 undefined
}
});

// 在呼叫 subscribe 之後，就可以結束 switch case
break;

          // ... inside switch(this.newconter)
case 2: // 修改 Email
   if (userText.includes('@')) {
            this.http
              .get<CkEmailIfExsit>(`http://localhost:8080/users/checkEmailExists/${userText}`)
                .subscribe({
                next:async res => {
                  if (res.code === 200) {
                  }else if(res.code == 400 && res.regularRegistration == true){
                    await this.showTypingThenMessage("抱歉，這個電子信箱已經被使用或是使用過Google登入，請使用其他的電子信箱，或是返回登入頁面");
                    return;
                }}})
          this.addBotMessage(`好的，您輸入的 email 是「${userText}」`);
          await this.showTypingThenMessage("正在為您發送驗證碼，請稍候...");
          this.IsokToType = true;
          this.newemail = userText;
          const newCode = this.codeManager.generateCode();
          console.log(`產生的驗證碼是: ${newCode}`);
          console.log(`新的電子信箱是: ${this.newemail}`);
          const webhookUrl = 'https://middlen8n.servehttp.com/webhook/41a43605-595b-4e43-89af-1a4499a6b26a';
          this.http.post(webhookUrl, {
    email: this.newemail,
    code: newCode,
}).subscribe({
    next: async (res: any) => { // 加上 async 關鍵字，因為要用 await
         console.log('================ DEBUG START ================');
    console.log('收到的原始回應 (res):', res);
    console.log('準備檢查 res.status 的值...');
    console.log('它的型別 (typeof) 是:', typeof res.status);
    console.log('它的實際值是:', `"${res.status}"`); // 用引號包起來，檢查是否有看不見的空白

    const isSuccess = (res.status === "success");
    console.log('res.status === "success" 的比較結果是:', isSuccess);
    console.log('================ DEBUG  END  ================');


        // --- 把你的判斷邏輯搬到這裡 ---
        if (isSuccess) { // 使用剛剛計算好的布林值
      console.log("偵測結果：進入了 SUCCESS 區塊！");
      // 成功訊息，附加上 email
      await this.showTypingThenMessage(`${res.message} ${this.newemail}`);
      // 成功後才去問下一個問題 (驗證碼)
      this.emailinputshow = false;
      await this.emailcheckagainSequence();
    } else {
      console.log("偵測結果：進入了 ELSE (ERROR) 區塊！");
      // 顯示 n8n 回傳的錯誤訊息
      await this.showTypingThenMessage(res.message || "該信箱格式錯誤或是不存在，請重新輸入");
      // 流程重置，讓使用者重新輸入 Email
      this.newconter = 2; // << 注意：這裡應該是重置 newconter
      this.IsokToType = true;
      this.emailinputshow = true;
    }
  },
    error: async (err) => { // 加上 async
        console.error('❌ Webhook 失敗：', err);
        // 這裡處理網路錯誤、n8n掛掉等問題
        await this.showTypingThenMessage("無法連接至伺服器，請稍後再試");
        this.newconter = 2; // 同樣重置流程
    },
    complete: () => console.log('🎉 呼叫完成'),
});}
  break;

          case 3: // 修改密碼
          this.IsokToType = false; // 禁止輸入

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,16}$/;
        if (passwordRegex.test(userText)) {
          this.registrationData.passwordHash = userText;
          this.newconter = 0;
          this.passwordinputshow = false;
          await this.showConfirmationSequence();


        } else {
          this.addBotMessage("抱歉，密碼格式不符合要求（6-16位，需含大小寫英文及數字），請再試一次。");
          this.IsokToType = true;
        }
        break;

          case 4: // 修改名稱
             if (userText.trim() === '') {
            this.IsokToType = false; // 禁止輸入
            this.addBotMessage("名稱不得為空，請重新輸入");
            this.IsokToType = true;
          } else {
            this.IsokToType = false; // 禁止輸入
            this.addBotMessage(`您選擇的名稱是「${userText}」`);
            this.registrationData.name=userText;
            this.newconter = 0;
            await this.showConfirmationSequence();
          }
        break;

          case 5: // 修改電話
            const phoneRegex = /^09\d{8}$/;
        if (phoneRegex.test(userText)) {
          this.IsokToType = false; // 禁止輸入
          this.addBotMessage(`您的電話號碼是「${userText}」`);
          this.registrationData.phoneNumber = userText;
          this.newconter = 0;
          await this.showConfirmationSequence();
        } else {
          this.IsokToType = false; // 禁止輸入
          this.addBotMessage("抱歉，電話號碼格式不正確，請再試一次");
          this.IsokToType = true;
        }
        break;

          case 6: // 修改頭像
          this.addBotMessage("請選擇「選擇頭像」來上傳頭像，或是「不選擇頭像」來跳過選擇");
          this.IsokToType = true; // 讓使用者可以重新輸入

        break;

          case 7: // 修改身分
            if (userText.trim() === '1') {
          await this.showTypingThenMessage("您選擇了一般使用者身分。");
          this.registrationData.role = 'customer';
          this.newconter = 0;
          await this.showConfirmationSequence();
        } else if (userText.trim() === '2') {
          await this.showTypingThenMessage("您選擇了店家使用者身分。");
          this.registrationData.role = 'merchants';
          this.newconter = 0;
          await this.showConfirmationSequence();
        } else {
          await this.showTypingThenMessage("請輸入「1」或「2」來選擇您的身分");
          this.IsokToType = true; // 讓使用者可以重新輸入
        }

        break;
          case 8:
            if (userText.trim() === '1') {
          this.IsokToType = false; // 禁止輸入
          this.addBotMessage("您已選擇重設電子信箱，請重新輸入您的電子信箱");
          this.newconter = 2; // 重置到第一個問題
          this.registrationData.email = ''; // 清除之前的電子信箱
          this.codeManager = new CodeManager(); // 重置驗證碼管理器
          this.IsokToType = true; // 允許重新輸入
          break;
          }
        if(userText.trim() === '') {
          this.IsokToType = false; // 禁止輸入
          this.addBotMessage("驗證碼不得為空，請重新輸入");
          this.IsokToType = true; // 允許重新輸入
          break;

        }
        if(userText.trim() === "2"){
          this.IsokToType = false; // 禁止輸入
          this.addBotMessage("您已選擇重新發送驗證碼，請稍候...");
          await this.showTypingThenMessage("已送出!");
          const newCode = this.codeManager.generateCode(); // 重新產生驗證碼
          console.log(`重新產生的驗證碼是: ${newCode}`);
          const webhookUrl = 'https://middlen8n.servehttp.com/webhook-test/41a43605-595b-4e43-89af-1a4499a6b26a';
          this.http.post(webhookUrl, { email: this.newemail, code: newCode });
          this.IsokToType = true; // 允許重新輸入
          break;
        }
        if (this.codeManager.IsExpiredOrNot) {
          if (this.countdownInterval) { clearInterval(this.countdownInterval); }
          this.IsokToType = false; // 禁止輸入
          this.addBotMessage("驗證碼已過期，將重新輸入email");

        } else if (this.codeManager.isCodeValid(userText)) {
          if (this.countdownInterval) { clearInterval(this.countdownInterval); }

          await this.showTypingThenMessage("驗證碼正確！");
          this.registrationData.email = this.newemail;
          this.newconter = 0;
          await this.showConfirmationSequence();

        } else {
          this.addBotMessage("驗證碼錯誤，請重新輸入。");
          this.IsokToType = true;
        }
        break;
          default:
            this.isModifying = false; // 不是有效的修改指令
            await this.showTypingThenMessage("抱歉，無法識別您的指令");
            this.IsokToType = true;
            break;
        }
        break;

      default:
        this.IsokToType = false; // 禁止輸入
        this.addBotMessage("對話流程出現問題，讓我們重新開始");
        this.currentQuestionId = 0; // 重置對話流程
        await this.showWelcomeSequence();
        break;
    }
  }

  async showWelcomeSequence(): Promise<void> {
    this.IsokToType = false;
    await this.showTypingThenMessage("您好！歡迎使用 Leftovers");
    await this.showTypingThenMessage("接下來為您辦理帳號註冊");
    if(!this.userService.isgoogleornot){
    await this.showTypingThenMessage("請問您的電子信箱是多少？");
    this.emailinputshow = true;
    this.currentQuestionId = 1;
    }else{
      await this.showTypingThenMessage("接下來請選擇您想申請的身分");
      await this.showTypingThenMessage("輸入「1」為一般使用者，輸入「2」為店家使用者");
      this.currentQuestionId = 4;
    }


    this.IsokToType = true;
  }

  async emailcheckedSequence(): Promise<void> {
    this.IsokToType=false;
    await this.showTypingThenMessage("驗證碼已送去您的信箱");
    this.addBotMessage('', { showTimer: true });
    await this.startCountdown(10);
    await this.showTypingThenMessage("請於倒數結束前輸入驗證碼 (6碼)", 800);
    await this.showTypingThenMessage("如果沒有收到驗證碼，請檢查您的垃圾郵件夾");
    await this.showTypingThenMessage("如果想重設信箱請輸入「1」，如果沒收到驗證信請輸入「2」");
    this.currentQuestionId = 2;
    this.IsokToType = true;
  }

  async emailcheckagainSequence(): Promise<void> {
    await this.showTypingThenMessage("驗證碼已送去您的信箱");
    this.addBotMessage('', { showTimer: true });
    await this.startCountdown(10);
    await this.showTypingThenMessage("請於倒數結束前輸入驗證碼 (6碼)", 800);
    await this.showTypingThenMessage("如果沒有收到驗證碼，請檢查您的垃圾郵件夾");
    await this.showTypingThenMessage("如果想重設信箱請輸入「1」，如果沒收到驗證信請輸入「2」");
    this.newconter = 8;
    this.IsokToType = true;
  }

  async passwordcheckedSequence(): Promise<void> {
    await this.showTypingThenMessage("現在請設定您的密碼");
    await this.showTypingThenMessage("格式為 6 到 16 個字元，且需包含大小寫英文各一個與一個數字，且不得含特殊字元如:(@#$%^&*()_+)");
    this.currentQuestionId = 3;
    this.passwordinputshow = true;
    this.IsokToType = true;
  }

  async typecheckedSequence(): Promise<void> {
    await this.showTypingThenMessage("接下來請選擇您想申請的身分");
    await this.showTypingThenMessage("輸入「1」為一般使用者，輸入「2」為店家使用者");
    this.currentQuestionId = 4; // 更新狀態以等待類型選擇
    this.IsokToType = true;
  }

  async usernamecheckedSequence(): Promise<void> {

    if(!this.userService.isgoogleornot){
    await this.showTypingThenMessage("接下來請輸入您想顯示的個人名稱");
    this.currentQuestionId = 5; // 更新狀態以等待類型選擇
    }else{
      await this.showTypingThenMessage("接下來請輸入您的電話號碼");
      this.currentQuestionId = 6;
    }
    this.IsokToType = true;
  }

  async phonecheckedSequence(): Promise<void> {
    await this.showTypingThenMessage("接下來請輸入您的電話號碼(須為09開頭)且共10碼");
    this.currentQuestionId = 6;
    this.IsokToType = true;
  }

  async userphotocheckedSequence(): Promise<void> {
    await this.showTypingThenMessage("接下來請選擇您的頭像");
    await this.showTypingThenMessage("如果您想要上傳自己的頭像，請點擊下方的上傳按鈕");
    await this.showTypingThenMessage("如果您不想上傳頭像，請選擇「跳過」");
    this.currentQuestionId = 7;
    this.IsokToType = true;
    this.photoopen =true;
  }

  private async showTypingThenMessage(text: string, delayMs = 1200): Promise<void> {
    this.addBotMessage('', { isLoading: true }); // 將 true 改為物件
    await delay(delayMs);
    this.messages.pop();
    this.addBotMessage(text);
  }

  scrollToBottom(): void {
    try {
      if (this.messageContainer) {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }

  scrollToBottomAfterRender(): void {
    setTimeout(() => this.scrollToBottom(), 0);
  }

   displayAvatarUpload(): void {
    this.showAvatarUploadUI = true;
    this.IsokToType = false; // 顯示上傳介面時，暫時禁用聊天輸入框
    this.havephoto = true;
  }

  // 當使用者點擊「不選擇頭像」按鈕
  async skipAvatarUpload(): Promise<void> {
    this.IsokToType = false;
    await this.showTypingThenMessage("好的，我們將為您設定一個預設頭像");
    this.avatarPreviewUrl ="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjMWYxZjFmIj48cGF0aCBkPSJNMjM0LTI3NnE1MS0zOSAxMTQtNjEuNVQ0ODAtMzYwcTY5IDAgMTMyIDIyLjVUNzI2LTI3NnEzNS00MSA1NC41LTkzVDgwMC00ODBxMC0xMzMtOTMuNS0yMjYuNVQ0ODAtODAwcS0xMzMgMC0yMjYuNSA5My41VDE2MC00ODBxMCA1OSAxOS41IDExMXQ1NC41IDkzWm0yNDYtMTY0cS01OSAwLTk5LjUtNDAuNVQzNDAtNTgwcTAtNTkgNDAuNS05OS41VDQ4MC03MjBxNTkgMCA5OS41IDQwLjVUNjIwLTU4MHEwIDU5LTQwLjUgOTkuNVQ0ODAtNDQwWm0wIDM2MHEtODMgMC0xNTYtMzEuNVQxOTctMTk3cS01NC01NC04NS41LTEyN1Q4MC00ODBxMC04MyAzMS41LTE1NlQxOTctNzYzcTU0LTU0IDEyNy04NS41VDQ4MC04ODBxODMgMCAxNTYgMzEuNVQ3NjMtNzYzcTU0IDU0IDg1LjUgMTI3VDg4MC00ODBxMCA4My0zMS41IDE1NlQ3NjMtMTk3cS01NCA1NC0xMjcgODUuNVQ0ODAtODBabTAtODBxNTMgMCAxMDAtMTUuNXQ4Ni00NC41cS0zOS0yOS04Ni00NC41VDQ4MC0yODBxLTUzIDAtMTAwIDE1LjVUMjk0LTIyMHEzOSAyOSA4NiA0NC41VDQ4MC0xNjBabTAtMzYwcTI2IDAgNDMtMTd0MTctNDNxMC0yNi0xNy00M3QtNDMtMTdxLTI2IDAtNDMgMTd0LTE3IDQzcTAgMjYgMTcgNDN0NDMgMTdabTAtNjBabTAgMzYwWiIvPjwvc3ZnPg==";
    await this.confirmAvatarUpload(); // << 跳回確認步驟
    this.havephoto=false;
  }


  // 當使用者點擊「取消」上傳
  cancelAvatarUpload(): void {
    this.showAvatarUploadUI = false; // 1. 切換回顯示「選擇頭像」/「不選擇」按鈕         // 2. 暫時禁止文字輸入，等待使用者重新點擊按鈕
    this.IsokToType =true;                                 //   (在 displayAvatarUpload 和 skipAvatarUpload 中會再次設為 true 或 false)
    // 3. 清空已選擇的檔案和預覽 URL
    this.selectedFile = null;
    this.avatarPreviewUrl = null;
  }

  // 當使用者在 <input type="file"> 中選擇了檔案
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // 檢查檔案大小 (可選但推薦)
      const maxSizeInMB = 2;
      if (file.size > maxSizeInMB * 1024 * 1024) {
        this.TriggerAlertService.trigger(`檔案大小不能超過 ${maxSizeInMB}MB`,"warning");
        return;
      }

      this.selectedFile = file; // 儲存檔案物件，以便上傳

      // --- 使用 FileReader 將圖片轉換為 Base64 Data URL ---
      const reader = new FileReader();
      reader.onload = (e) => {
        // 當讀取完成後，將結果存到 avatarPreviewUrl 中
        // 這個結果就是一長串的 Base64 字串，可以直接在 <img> 的 src 中使用
        this.avatarPreviewUrl = reader.result;
        console.log('圖片預覽 URL (Base64):', this.avatarPreviewUrl);
      };
      reader.readAsDataURL(file); // 開始讀取檔案
      // ----------------------------------------------------
    }
  }

  // 當使用者點擊「確認上傳」按鈕
  async confirmAvatarUpload(): Promise<void> {

    if (!this.avatarPreviewUrl) {
      this.TriggerAlertService.trigger("請先選擇一個檔案！","warning");
      return;
    }
    if(!this.isfirstphotoupdate){
    this.IsokToType = false;
    this.photoopen =false;
    if(this.havephoto){
    await this.showTypingThenMessage(`收到檔案「${this.selectedFile?.name}」，正在處理...`);
    }
    this.registrationData.profilePictureUrl = this.avatarPreviewUrl as string;
    await this.showTypingThenMessage("頭像上傳成功！"+ '<br>' +"接下來請確認資料有沒有要修改");

            let message = "";

        if (!this.userService.isgoogleornot) {
          message += "您選擇註冊的 Email 是: " + this.registrationData.email + "<br>";
          message += "您選擇的密碼是: " + this.registrationData.passwordHash + "<br>";
        }

        message += "您選擇的名稱是: " + this.registrationData.name + "<br>";
        message += "您選擇的電話號碼是: " + this.registrationData.phoneNumber + "<br>";
        message += "您選擇的身分是: " +
                  (this.registrationData.role === 'customer' ? "一般使用者" : "店家使用者");

        await this.showTypingThenMessage(message);
        this.addAvatarPreviewMessage();
    if(!this.userService.isgoogleornot){
    await this.showTypingThenMessage(
  "如果您確認無誤，請輸入「1」來完成註冊<br>" +
  "如果您想要修改電子信箱，請輸入「2」來重新輸入電子信箱<br>" +
  "如果您想要修改密碼，請輸入「3」來重新上傳密碼<br>" +
  "如果您想要修改名稱，請輸入「4」來重新輸入名稱<br>" +
  "如果您想要修改電話號碼，請輸入「5」來重新輸入電話號碼<br>" +
  "如果您想要修改頭像，請輸入「6」來重新上傳頭像<br>" +
  "如果您想要修改身分，請輸入「7」來重新選擇身分"
);


    this.currentQuestionId = 8; // 進入確認資料狀態
    this.IsokToType=true;
    this.isfirstphotoupdate=true;
    this.newconter = 0;
  }else if(this.userService.isgoogleornot){
    await this.showTypingThenMessage(
  "如果您確認無誤，請輸入「1」來完成註冊<br>" +
  "如果您想要修改名稱，請輸入「2」來重新輸入名稱<br>" +
  "如果您想要修改電話號碼，請輸入「3」來重新輸入電話號碼<br>" +
  "如果您想要修改頭像，請輸入「4」來重新上傳頭像<br>" +
  "如果您想要修改身分，請輸入「5」來重新選擇身分"
);


    this.currentQuestionId = 8; // 進入確認資料狀態
    this.IsokToType=true;
    this.isfirstphotoupdate=true;
    this.newconter = 0;
  }
}else{
    this.showConfirmationSequence();
    this.newconter = 0;
  }
    // this.currentQuestionId = 99; // 進入結束狀態
  }

   async showConfirmationSequence(): Promise<void> {
    this.isModifying = false; // 修改完畢，重置修改狀態
    this.photoopen=false;
    this.showAvatarUploadUI = false; // 確保檔案上傳介面已關閉
    await this.showTypingThenMessage("資料已更新！請再次確認您的註冊資料：");
    if(!this.userService.isgoogleornot){
    await this.showTypingThenMessage(
      "Email: " + this.registrationData.email + "<br>" +
      "密碼: " + this.registrationData.passwordHash
    );
    }
    const roleText = this.registrationData.role === 'customer' ? "一般使用者" : "店家使用者";
    await this.showTypingThenMessage(
      "名稱: " + this.registrationData.name + "<br>" +
      "電話: " + this.registrationData.phoneNumber + "<br>" +
      "身分: " + roleText
    );

    await this.addAvatarPreviewMessage();

    await this.showTypingThenMessage("如果確認無誤，請輸入「1」來完成註冊。");
    if(!this.userService.isgoogleornot){
    await this.showTypingThenMessage("若要繼續修改，請輸入對應的編號 (2-7)。");
    }else{
      await this.showTypingThenMessage("若要繼續修改，請輸入對應的編號 (2-5)。");
    }
    this.currentQuestionId = 8;
    this.IsokToType = true;
  }

}
