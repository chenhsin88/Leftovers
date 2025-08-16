import { Injectable ,Injector} from '@angular/core';
import { Observable, of, BehaviorSubject, delay, throwError, Subject, throttleTime } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { HttpClientModule } from '@angular/common/http';
import { map, tap, catchError, switchMap, finalize } from 'rxjs/operators';
import { TriggerAlertService } from '../@Services/trigger-alert.service';
import { Router, NavigationEnd } from '@angular/router';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { Subscription } from 'rxjs';
import { CustomSnackbarComponent, CustomSnackbarData } from '../custom-snackbar/custom-snackbar.component';
import { Product } from '../main/main.component';
import { jwtDecode } from 'jwt-decode';
import { filter } from 'rxjs/operators'
import { MerchantsService } from './merchants.service';


export interface UserLogin {
  id?: number | string;            // ID 通常是必須的，可以是數字或字串(如UUID)，設為可選以方便創建新用戶
  email: string;
  passwordHash: string;           // 雖然這是假資料，但命名為 passwordHash 表示這不應是明文密碼
  name: string;
  phoneNumber: string;
  profilePictureUrl: string;      // 這是圖片的網址
  role: 'customer' | 'merchants' | 'admin'; // 使用聯合類型 (Union Types) 可以限制角色，比單純 string 更安全
}
export interface NewUserLogin {
  id?: number | string;            // ID 通常是必須的，可以是數字或字串(如UUID)，設為可選以方便創建新用戶
  email: string;
  passwordHash: string;           // 雖然這是假資料，但命名為 passwordHash 表示這不應是明文密碼
  name: string;
  phoneNumber: string;
  profilePictureUrl: string;      // 這是圖片的網址
  role: 'customer' | 'merchants' | 'admin'; // 使用聯合類型 (Union Types) 可以限制角色，比單純 string 更安全
  isActive: boolean;
  regularRegistration: boolean;
}
export interface FoodItemPriceChange {
  food_items_id: number;          // 食物品項 ID
  merchants_id: number;           // 商家 ID
  previous_price: number;         // 原價格
  new_price: number;              // 新價格
  set_time: string;               // 生效時間（ISO 字串格式，如 '2025-06-18T12:00:00Z'）
  push_notifications: boolean;    // 是否推播通知
  default_hours: number;          // 預設提前幾小時通知
}


interface arraydatatype {
  email: string;
  name: string;
  phoneNumber: string;
  profilePictureUrl: string;
  role: 'customer' | 'merchants' | 'admin';
}
//後端回的資料
export interface fooditemApiResponse {
  code: number;               // 狀態碼
  message: string;            // 狀態訊息
  vos: fooditem[];           // 包含商品物件的陣列
}


// 用於描述 foodList 陣列中的每一個食物品項
export interface fooditem {
  id: number;                      // 食物ID
  merchantsId: number;             // 所屬商家ID
  name: string;                    // 食物名稱
  description: string;             // 食物描述
  imageUrl: string;                // 食物圖片URL (可能是 data:image/png;base64,... 或一般網址)
  originalPrice: number;           // 原價
  discountedPrice: number;         // 折扣後價格
  quantityAvailable: number;       // 可用數量
  pickupStartTime: string;         // 可取餐開始時間 (ISO 8601 日期時間字串)
  pickupEndTime: string;           // 可取餐結束時間 (ISO 8601 日期時間字串)
  category: string;                // 食物類別
  createdAt: string;               // 建立時間 (ISO 8601 日期時間字串)
  updatedAt: string;               // 最後更新時間 (ISO 8601 日期時間字串)
  active: boolean;                 // 此品項是否啟用
  showCheckmark?: boolean;
}


// 用於描述 vo 陣列中的每一個商家物件
export interface Merchant {
  merchantsId: number; // 商家ID
  name: string; // 商家名稱
  description: string | null; // 商家描述
  addressText: string; // 地址文字
  phoneNumber: string; // 聯絡電話
  logoUrl: string; // 商家Logo的URL
  bannerImageUrl: string | null; // 商家橫幅圖片的URL
  mapGoogleUrl: string; // Google地圖的URL
  opening_hoursDescription?: string; // 營業時間
  longitudeAndLatitude: string | null; // 經緯度資訊
  foodList: fooditem[]; // 食物清單
  averageRating?: number; // 平均評分
  reviewCount?: number; // 評論數量
  reviews?: Review[]; // 評論列表
  mapScreenshotUrl: string | null;
}

export interface MerchantDetailApiResponse {
  code: number; // API回應狀態碼 (例如: 200)
  message: string; // API回應訊息
  merchant: Merchant; // 商家資料
  averageRating: number; // 平均評分
  reviewCount: number; // 評論數量
  reviews: Review[]; // 評論列表
}

// 用於描述商家評論的結構
export interface Review {
  rating: number;
  comment: string;
  userName: string;
  createdAt: string;
  merchantReply: string | null;
  merchantReplyAt: string | null;
  profilePictureUrl: string | null;
}

// 最外層的 API 回應結構
export interface MerchantApiResponse {
  code: number;                    // API回應狀態碼 (例如: 200)
  message: string;                 // API回應訊息 (例如: "Success!!")
  vo: Merchant[];                  // 主要的資料內容 (一個包含多個商家物件的陣列)
}


// 後端 /login API 的回應
export interface LoginApiResponse {
  accessToken: string;
}


// 後端 /me API 回應的使用者資料結構
export interface UserVo {
  email: string;
  name: string;
  phoneNumber: string;
  profilePictureUrl: string;
  role: 'customer' | 'merchants' | 'admin';
  regularRegistration: boolean;
}

export interface UserUpdateReq {
  email: string; // email 是必須的，用來識別使用者
  name?: string;
  phoneNumber?: string;
  passwordHash?: string; // 注意：這是新密碼
  profilePictureUrl?: string;
  currentPassword?: string;
}

export interface BasicRes {
  code: number;
  message: string;
}
export interface OrderToReviewVo {
  numericOrderId: number;
  displayOrderId: string;
  merchantName: string;
  orderDate: string; // 在 TypeScript 中，日期通常先當作字串處理
  foodName: string;
}

export interface OrdersToReviewRes {
  code: number;
  message: string;
  orders: OrderToReviewVo[];
}
export interface SingleMerchantApiResponse {
  code: number;
  message: string;
  merchants: Merchant[];
}

export interface CkEmailIfExsit {


  code: number,
  message: string
  role: 'customer' | 'merchants' | 'admin';
  regularRegistration: boolean;
}
export interface MeApiResponse {
  user: UserVo;
  accessToken: string;
}
export interface msg {
  code: number,
  message: string
}

// 定義單一則 SSE 通知訊息的資料結構
export interface SseNotification {
  id: string;
  title: string;
  items: { name: string; price: number }[];
  receivedAt: Date;
  rawMessage: string;
}

@Injectable({
  providedIn: 'root'


})
export class UsersServicesService {
  private avatarCache = new Map<string, string>();
  private clientSideCart: fooditem[] = [];
  private previousUrl: string = '/main';
  public setPreviousUrl(url: string): void {
    console.log('[Navigation] 已儲存返回路徑:', url);
    this.previousUrl = url;
  }

  // ★ 3. 新增這個方法，讓其他元件可以取得儲存好的 URL
  public getPreviousUrl(): string {
    return this.previousUrl;
  }
  private locationUpdateSubject = new Subject<{ lat: string, lon: string }>();
  // =======================================================
  // ============= START: 新增的 SSE 通知邏輯 =============
  // =======================================================


  // 控制是否要彈出 Snackbar 的開關狀態
  private _showPopupNotifications = new BehaviorSubject<boolean>(true);
  public showPopupNotifications$ = this._showPopupNotifications.asObservable();

  // 存放所有接收到的通知列表
  private _notifications = new BehaviorSubject<SseNotification[]>([]);
  public notifications$ = this._notifications.asObservable();

  // 未讀通知的計數
  private _unreadCount = new BehaviorSubject<number>(0);
  public unreadCount$ = this._unreadCount.asObservable();

  // 當收到新訊息時，用來觸發事件的 Subject
  private newSseMessageSubject = new Subject<CustomSnackbarData>();
  public newSseMessage$ = this.newSseMessageSubject.asObservable();


  // 建立一個專門用來「廣播新商品陣列」的頻道 (Subject)
  private newProductsSubject = new Subject<Product[]>();
  // 讓外部元件可以訂閱這個頻道，但不能主動推資料進來
  public newProducts$ = this.newProductsSubject.asObservable();

  private locationWatchId: number | null = null;

  private eventSource: EventSource | null = null;
  constructor(
    private http: HttpClient,
    private triggerAlertService: TriggerAlertService,
    private router: Router,
    private authService: SocialAuthService,
    private injector: Injector



  ) {
    this.loadLocationFromStorage();
    this.locationUpdateSubject.pipe(
      // === 核心修改：控制更新頻率，例如每 10 秒最多處理一次 ===
      throttleTime(10000)
    ).subscribe(location => {
      console.log('[UserService Throttled] 節流後，處理並廣播位置更新:', location);
      // 只有通過節流的事件，才會真正去更新位置
      this.setLocation(location);
    });
    const currentUrl = window.location.href;
    if (currentUrl.includes('source=google')) {
      console.log('[UserService] 偵測到 URL 包含 google 來源，設定 isgoogleornot = true');
      this.isgoogleornot = true;
    }

    // 監聽後續的路由變化，如果離開了註冊頁，就重設旗標和 localStorage
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // 如果最新的 URL *不包含* signup，就代表註冊流程已結束或被放棄
      if (!event.urlAfterRedirects.includes('/signup')) {
        if (this.isgoogleornot) {
          console.log('[UserService] 已離開註冊流程，重設 isgoogleornot 並清除暫存資料。');
          this.isgoogleornot = false;
          localStorage.removeItem('tempGoogleUser');
        }
      }
    });
    // 檢查本地儲存，以還原使用者對於彈窗的偏好設定
    const savedPreference = localStorage.getItem('showPopupNotifications');
    if (savedPreference !== null) {
      this._showPopupNotifications.next(JSON.parse(savedPreference));
    }
  }

  EmailExists: boolean = false; // 用於檢查 email 是否已存在
  userRole?: string = "";
  isgoogleornot: boolean = false;
  mylocation?: { lat: string, lon: string } | null = null;
  myemail: string = "";
  myname: string = "";
  loginsucces: boolean = false;
  fallbackAvatar = '';


  AccountData: arraydatatype[] = []
  MerchantData: Merchant[] = [];
  category: FoodItemPriceChange[] = [];
  FoodItems: fooditem[] = [];

  // 用於 App 自動控制的旗標 (例如根據路由)
  private _appAllowsNotifications = new BehaviorSubject<boolean>(true);

  // 用於使用者手動開關的旗標
  private _userPrefersNotifications = new BehaviorSubject<boolean>(true);

  private scrollToResultsSubject = new Subject<void>();
  public scrollToResults$ = this.scrollToResultsSubject.asObservable();
  public triggerScrollToResults(): void {
    console.log('[UserService] Broadcasting "scroll to results" signal...');
    this.scrollToResultsSubject.next();
  }

  private currentUserSubject = new BehaviorSubject<UserVo | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();


  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  public get currentUserValue(): UserVo | null {
    return this.currentUserSubject.getValue();
  }

  public get isLoggedInValue(): boolean {
    return this.isLoggedInSubject.getValue();
  }

  private locationSubject = new BehaviorSubject<{ lat: string, lon: string } | null>(null);
  public location$ = this.locationSubject.asObservable();

  public get locationValue(): { lat: string, lon: string } | null {
    return this.locationSubject.getValue();
  }

  private appLoadingSubject = new BehaviorSubject<boolean>(true);
  public appLoading$ = this.appLoadingSubject.asObservable();


  private clearSearchSubject = new Subject<void>();
  public clearSearch$ = this.clearSearchSubject.asObservable();
  public triggerClearSearch(): void {
    console.log('[UserService] Broadcasting "clear search" signal...');
    this.clearSearchSubject.next();
  }


  private accessToken: string | null = null;
  private isGoogleLogin: boolean = false;


  private readonly userApiUrl = 'http://localhost:8080/users';
   private readonly reviewsApiUrl = 'http://localhost:8080/reviews';

  private UserUrl = 'http://localhost:8080/users';
  private MerchantUrl = 'http://localhost:8080/merchants';
  private FoodItemUrl = 'http://localhost:8080/fooditems';


  getAccessToken(): string | null {
    return this.accessToken;
  }


  AccountDataRegister(data: NewUserLogin): Observable<any> {
    // 直接回傳 http.post 的結果，讓呼叫它的地方 (component) 去處理後續
    return this.http.post<msg>(`${this.UserUrl}/register`, data);
  }


  GetAllItem(data: UserLogin): Observable<any> {
    return this.http.post(`${this.UserUrl}/getAll`, data);


  }
  private loadLocationFromStorage(): void {
    try {
      const savedLocationJson = localStorage.getItem('userLocation');
      if (savedLocationJson) {
        const savedLocation = JSON.parse(savedLocationJson);
        if (savedLocation && savedLocation.lat && savedLocation.lon) {
          // 讀到後，用 .next() 發送一個新的「位置」訊號
          this.locationSubject.next(savedLocation);
          console.log('[LocalStorage] 已成功載入並廣播位置資訊。');
        }
      }
    } catch (e) {
      console.error('[LocalStorage] 讀取或解析位置時失敗:', e);
    }
  }


  // ★ 4. 新增一個公開方法，讓 location.component 可以設定新位置
  public setLocation(location: { lat: string, lon: string }): void {
    try {
      localStorage.setItem('userLocation', JSON.stringify(location));
      // 當位置被設定時，也用 .next() 發送一個新的「位置」訊號
      this.locationSubject.next(location);
      console.log('[UserService] 位置已設定並廣播。');
    } catch (e) {
      console.error('[LocalStorage] 儲存位置時失敗:', e);
    }
  }
  getAllMerchants(km: number, lat: number, lon: number): Observable<Merchant[]> {
    return this.http.post<MerchantApiResponse>(`${this.MerchantUrl}/getMerchantAndFoodItemsWithinRange`, {
      "distance": km,
      "userLat": lat,
      "userLon": lon
    }).pipe(
      // 1. 先從 API 回應中取出 'vo' 陣列
      map(response => response.vo || []), // 加上 || [] 確保在沒有 vo 時也能安全回傳空陣列


      // 2. ★ 新增: 使用 tap 將取出的商家資料存入 Service 的屬性中
      tap(merchants => {
        this.MerchantData = merchants;
        console.log('[UserService] 已成功獲取並快取商家資料。', this.MerchantData);
      }),


      // 3. 錯誤處理
      catchError(err => {
        console.error('取得商家資料失敗:', err);
        this.MerchantData = []; // 發生錯誤時清空陣列
        return of([]); // 回傳一個空的 Observable，讓訂閱方不會因錯誤而中斷
      })
    );
  }
  getAllFoodItems() {
    this.AccountData
  }
  /**
   * 根據商家 ID 取得食物列表，並只回傳食物陣列
   */
  // getAllFoodItems(merchantId: number): Observable<fooditem[]> {
  //   return this.http.post<fooditemApiResponse>(`${this.FoodItemUrl}/getAllByMerchantId`, { "merchantsId": merchantId }).pipe(
  //     map(response => response.vos || []), // 只取出 vos 陣列
  //     catchError(err => {
  //       return of([]); // 出錯時回傳空陣列，避免中斷整個流程
  //     })
  //   );
  // }


  // registerAndCache(data: UserLogin): void {
  //   this.AccountDataRegister(data).subscribe({
  //     next: res => {
  //       console.log('註冊成功，後端回傳：', res);
  //       this.AccountData.push(data);
  //     },
  //     error: err => {
  //       console.error('註冊失敗：', err);
  //     }
  //   });
  // }




  login(email: string, passwordHash: string, returnUrl: string): Observable<UserVo> {
    // 登入請求只負責拿 token
    const loginRequest = this.http.post<LoginApiResponse>(`${this.userApiUrl}/login`, { email, passwordHash, regularRegistration: false });


    return loginRequest.pipe(
      // 使用 switchMap 將 /login 的結果轉換成呼叫 /me
      switchMap(response => {
        if (response && response.accessToken) {
          this.accessToken = response.accessToken;
          this.isGoogleLogin = false;
          // 登入成功後，立刻去取得使用者資料
          return this.fetchCurrentUser(); // fetchCurrentUser 現在只會更新狀態，不會導航或提示
        }
        // 如果登入沒拿到 token，就拋出錯誤
        return throwError(() => new Error('未收到 Access Token'));
      }),


      // ★★★ 在整個登入流程的最後，才執行提示和導航 ★★★
      tap(userVo => {
        // 1. 顯示歡迎訊息
        this.triggerAlertService.trigger(`登入成功！歡迎 ${userVo.name}`, 'success', 3000);
        // 1. 最高優先級：檢查角色
        if (userVo.role === 'merchants') {
          // 我們已經確定使用者是商家。現在才檢查他是否想去一個顧客頁面。

          // 無論如何，商家一律導航至商家專屬頁面
          console.log("使用者為商家，一律導航至商家列表 /storeList");
          this.router.navigate(['/storeList']);
        }
        // 2. 第二優先級：檢查 returnUrl (此時已確定是顧客角色)
        else if (returnUrl) {
          console.log(`顧客登入，且偵測到 returnUrl，導航至: ${returnUrl}`);
          this.router.navigateByUrl(returnUrl);
        }
        // 3. 預設路徑：無 returnUrl 的顧客
        else {
          if (this.mylocation) {
            this.router.navigate(['/main']);
          } else {
            this.router.navigate(['/location']);
          }
        }
      }),


      // 捕捉整個流程中可能發生的錯誤
      catchError(error => {
        // 從後端回應中取得更具體的錯誤訊息
        const errorMessage = error.error?.message;

          this.triggerAlertService.trigger(errorMessage, 'error', 4000);


        return throwError(() => error);
      })
    );
  }
  /**
   * ★ 4. 重構後的 Google 登入方法
   */
  googlelogin(email: string, returnUrl: string): Observable<UserVo> {
    const loginRequest = this.http.post<LoginApiResponse>(`${this.userApiUrl}/login`, { email, regularRegistration: true });


    return loginRequest.pipe(
      switchMap(response => {
        if (response && response.accessToken) {
          this.accessToken = response.accessToken;
          // ★ 成功拿到 token 後，一樣去獲取使用者資料
          return this.fetchCurrentUser();
        }
        return throwError(() => new Error('未收到 Access Token'));
      }),
      // ★★★ 關鍵修改：在 login/googlelogin 流程的最後，才執行提示和導航 ★★★
      tap(userVo => {
        // 1. 顯示歡迎訊息
        this.triggerAlertService.trigger(`登入成功！歡迎 ${userVo.name}`, 'success', 3000);

        // 1. 最高優先級：檢查角色
        if (userVo.role === 'merchants') {
          // 我們已經確定使用者是商家。現在才檢查他是否想去一個顧客頁面。
          const parts = returnUrl.split('/');
          if (parts.length === 3 && parts[0] === 'merchant' && parts[1] && parts[3] === 'storeManagement') {
            // parts[1] 將會是實際的商家 ID
            // 這是商家頁面，執行相應的邏輯
            this.triggerAlertService.trigger(`您登入的是商家身分，無法前往顧客頁面`, 'warning', 4000);
          }
          // 無論如何，商家一律導航至商家專屬頁面
          console.log("使用者為商家，一律導航至商家列表 /storeList");
          this.router.navigate(['/storeList']);
        }
        // 2. 第二優先級：檢查 returnUrl (此時已確定是顧客角色)
        else if (returnUrl) {
          console.log(`顧客登入，且偵測到 returnUrl，導航至: ${returnUrl}`);
          this.router.navigateByUrl(returnUrl);
        }
        // 3. 預設路徑：無 returnUrl 的顧客
        else {
          if (this.mylocation) {
            this.router.navigate(['/main']);
          } else {
            this.router.navigate(['/location']);
          }
        }
      })
    );
  }


  /**
   * ★ 5. 抽離出一個私有方法，專門用於在登入後取得使用者資料並執行後續操作
   */
  private fetchCurrentUser(): Observable<UserVo> {
    return this.http.get<MeApiResponse>(`${this.userApiUrl}/me`).pipe(
      tap(response => {
        if (response && response.user && response.accessToken) { // 加上對 accessToken 的檢查

        // 【這就是修正！】
        // 用從 /me 拿到的新 Token，去更新 Service 中儲存的 Token
        this.accessToken = response.accessToken;

        const userVo = response.user;
        this.currentUserSubject.next(userVo);
        this.isLoggedInSubject.next(true);
        } else {
          throw new Error("從 /me 收到的回應格式不正確");
        }
      }),
      // ★ map 的功能維持不變
      map(response => response.user)
    );
  }
  /**
   * 【新增這個方法】
   * 用於刷新 Access Token
   */
  refreshToken(): Observable<any> {
    return this.http.post<any>(`${this.userApiUrl}/refresh`, {}).pipe(
      tap((response) => {
        if (response && response.accessToken) {
          console.log('成功刷新 Access Token!');
          // 將新的 token 存到記憶體中
          this.accessToken = response.accessToken;
        }
      })
    );
  }

  populateAuthStateOnLoad(): Observable<any> {
    // 應用程式啟動時，嘗試呼叫 /refresh 來換取新的 accessToken
    this.appLoadingSubject.next(true);
    return this.http.post<any>(`${this.userApiUrl}/refresh`, {}).pipe(
      switchMap(response => {
        // 如果成功從後端拿到新的 accessToken
        if (response && response.accessToken) {
          console.log('透過 Refresh Token 成功取得新的 Access Token!');
          // 將新的 token 存到記憶體中
          this.accessToken = response.accessToken;
          // 接著，用這個剛拿到的 token 去取得使用者完整資料
          return this.fetchCurrentUser();
        }
        // 如果後端沒回傳 accessToken，就回傳一個空的 Observable，表示初始化完成但未登入
        return of(null);
      }),
      catchError(() => {
        // 如果 /refresh API 呼叫失敗 (例如 cookie 過期或無效)，
        // 這屬於正常情況，代表使用者需要手動登入。
        // 我們安靜地處理掉這個錯誤，讓使用者保持登出狀態即可。
        return of(null); // 回傳 of(null) 來確保 APP_INITIALIZER 流程能正常結束
      }),
      finalize(() => {
        this.appLoadingSubject.next(false);
      })
    );
  }


  /**
   * ★ 6. 根據角色導航的輔助方法
   */
  private navigateByRole(role: 'customer' | 'merchants' | 'admin'): void {
    if (role === 'customer') {
      this.router.navigate(['/location']); // 顧客導航到地圖/地點頁
    } else if (role === 'merchants') {
      this.router.navigate(['/merchant-dashboard']); // 商家導航到儀表板 (路徑請替換成您自己的)
    } else if (role === 'admin') {
      this.router.navigate(['/admin-panel']); // 管理員導航到後台 (路徑請替換成您自己的)
    } else {
      this.router.navigate(['/']); // 預設導航
    }
  }
  CkEmailAlready(email: string): void {
    this.http
      .get<CkEmailIfExsit>(`${this.UserUrl}/checkEmailExists/${email}`)
      .subscribe({
        next: res => {
          if (res.code === 200) {
            this.triggerAlertService.trigger("請先完成個人資料註冊", "info")
            this.router.navigate(['/signup']); // 如果沒有找到使用者，則導航去註冊頁面
          }
        }
      }
      )


  }
  CkEmailAlreadyExsit(email: string): Observable<boolean> {
    return this.http
      .get<CkEmailIfExsit>(`${this.UserUrl}/checkEmailExists/ ${email}`)
      .pipe(
        // 先印詳細回傳內容，方便偵錯
        tap(res => {
          if (res.code === 200) {


          }
        }),
        // 把整個物件映射成 true/false
        map(res => res.code === 200),
        // 如果發生網路或其他錯誤，也回傳 false
        catchError(err => {
          return of(false);
        })
      );
  }
  LoginNow() {
    this.loginsucces = true;
    this.isLoggedInSubject.next(true)
  }


  async LoginOutNow(): Promise<void> {
    this.http.post(`${this.userApiUrl}/logout`, {}).subscribe({
      next: () => {
        console.log('[Logout] Backend cookie cleared successfully.');
        // ★ 步驟二：在後端成功後，才執行前端的清理和導航
        this.clearFrontendStateAndNavigate();
      },
      error: err => {
        console.error('[Logout] Backend logout call failed, but proceeding with frontend cleanup anyway.', err);
        // 即使後端呼叫失敗，我們仍然要清理前端的狀態，確保使用者體驗
        this.clearFrontendStateAndNavigate();
      }
    });
    if (this.currentUserValue?.regularRegistration == true) {
      try {
        // 檢查 SocialAuthService 的狀態，確保它已準備就緒
        if (this.authService.authState) {
          await this.authService.signOut();
          console.log('[Logout] Successfully signed out from Google.');
        }
      } catch (error) {
        console.error('[Logout] Error signing out from Google:', error);
        // 即使 Google 登出失敗，我們仍然要繼續執行本地的登出流程
      }
    }
  }
  private clearFrontendStateAndNavigate(): void {
    localStorage.removeItem('userLocation');
    // 清除所有前端的狀態
    this.accessToken = null;
    this.currentUserSubject.next(null);
    this.isLoggedInSubject.next(false);
    this.locationSubject.next(null);
    this.isGoogleLogin = false;
    this.loginsucces = false;
    this.userRole = '';
    this.myemail = ''
    this.myname = '';
    this.isLoggedInSubject.next(false);
    this.isgoogleornot = false;
    this.AccountData = [];
    this.MerchantData = [];
    this.FoodItems = [];
    this.category = [];
    // this.triggerAlertService.trigger('已登出','info',3000);
    // 清除快取的頭像 URL
    this.avatarCache.clear();
    this.mylocation = null;
     const merchantsService = this.injector.get(MerchantsService);

    // 現在可以安全地呼叫它的方法，因為循環已經被打破
    merchantsService.clearCache();
    // this.router.navigate(['/login']);
    this.accessToken = null;

    this.triggerAlertService.trigger('已登出', 'info', 3000);
    this.clientSideCart = [];
    this.router.navigate(['/login']);
  }


  /**
  * 【新增這個完整的方法】
  * 根據商家 ID 從快取的 MerchantData 中取得單一商家資訊
  * @param id 商家 ID
  * @returns Observable<Merchant | undefined>
  */
  getMerchantById(id: number): Observable<Merchant | undefined> {
    // 1. 優先從快取中尋找
    const cachedMerchant = this.MerchantData.find(m => m.merchantsId === id);

    if (cachedMerchant) {
      console.log(`[Service] 從快取中成功找到店家 ID: ${id}`);
      // 如果快取中有，就用 of() 包裝成 Observable，立即回傳
      return of(cachedMerchant);
    }

    // 2. 如果快取中沒有，則啟動後端備援計畫
    console.log(`[Service] 快取中找不到店家 ID: ${id}，準備向後端請求...`);
    // 呼叫我們即將建立的新方法
    return this.getSingleMerchantFromBackend(id);
  }

  /**
   * 【新增這個方法】
   * 專門用於從後端 API 取得單一商家的詳細資料
   * @param id 商家 ID
   */
  private getSingleMerchantFromBackend(id: number): Observable<Merchant | undefined> {
    // 1. 使用您提供的正確 URL
    const merchantApiUrl = `${this.MerchantUrl}/getMerchantsData/${id}`;

    // 2. ★★★ 使用正確的 GET 方法，並且不需要傳送 body ★★★
    return this.http.get<SingleMerchantApiResponse>(merchantApiUrl).pipe(
      // 使用 switchMap 來串接第二個 API 請求
      switchMap(merchantResponse => {
        // 3. ★★★ 根據您提供的 JSON，從 'merchants' 陣列中取資料 ★★★
        if (merchantResponse && merchantResponse.code === 200 && merchantResponse.merchants && merchantResponse.merchants.length > 0) {
          const merchantData = merchantResponse.merchants[0];

          // API 2: 使用商家的 ID 去取得該商家的所有商品 (這部分不變)
          const foodItemsApiUrl = `http://localhost:8080/fooditems/getAllByMerchantId`;
          return this.http.post<fooditemApiResponse>(foodItemsApiUrl, { merchantsId: id }).pipe(
            map(foodResponse => {
              if (foodResponse && foodResponse.code === 200) {
                // 將商品列表 (foodList) 組合回商家物件中
                merchantData.foodList = foodResponse.vos || [];
              } else {
                merchantData.foodList = [];
              }
              console.log(`[API] 成功組合店家 ID: ${id} 的資訊與商品列表`);
              return merchantData; // 回傳組合好的完整 Merchant 物件
            }),
            catchError(foodErr => {
              console.error(`[API] 獲取店家 ID: ${id} 的商品列表時失敗:`, foodErr);
              merchantData.foodList = [];
              return of(merchantData);
            })
          );
        } else {
          console.error(`[API] 後端找不到店家 ID: ${id}`);
          return of(undefined);
        }
      }),
      catchError(merchantErr => {
        console.error(`[API] 請求店家 ID: ${id} 的基本資料時發生嚴重錯誤:`, merchantErr);
        return of(undefined);
      })
    );
  }

  getMerchantDetails(id: number): Observable<Merchant | undefined> {
    const detailApiUrl = `${this.MerchantUrl}/detail/${id}`;

    return this.http.get<MerchantDetailApiResponse>(detailApiUrl).pipe(
      map(response => {
        if (response && response.code === 200 && response.merchant) {
          const merchantData = response.merchant;
          // 將評分和評論組合回 merchant 物件中
          merchantData.averageRating = response.averageRating;
          merchantData.reviewCount = response.reviewCount;
          merchantData.reviews = response.reviews;
          return merchantData;
        }
        return undefined;
      }),
      catchError(err => {
        console.error(`[API] 請求店家詳細資料 ID: ${id} 時發生錯誤:`, err);
        return of(undefined);
      })
    );
  }

  updateUser(updateData: UserUpdateReq): Observable<BasicRes> {
    return this.http.post<BasicRes>(`${this.userApiUrl}/update`, updateData).pipe(
      tap(response => {
        // 如果後端成功更新 (code 200)
        if (response && response.code === 200) {
          console.log('使用者資料更新成功:', response.message);

          // 更新 BehaviorSubject 中的使用者資料
          const currentUser = this.currentUserSubject.getValue();
          if (currentUser) {
            // 建立一個新的物件，混合舊資料和新資料
            const updatedUser = { ...currentUser, ...updateData };
            this.currentUserSubject.next(updatedUser);
            this.triggerAlertService.trigger('個人資料已更新！', 'success', 3000);
          }
        } else {
          // 如果後端回傳成功，但 code 不是 200
          this.triggerAlertService.trigger(response.message || '更新失敗，請稍後再試。', 'error', 4000);
        }
      }),
      catchError(error => {
        // 處理 HTTP 錯誤 (例如 400, 500)
        const errorMessage = error.error?.message || '發生未知錯誤，更新失敗。';
        console.error('更新使用者資料時發生錯誤:', error);
        this.triggerAlertService.trigger(errorMessage, 'error', 5000);
        return throwError(() => new Error(errorMessage));
      })
    );
  }








  // newlogin(){
  //   this.loginsucces=true;
  // }


  // findrole(email: string){
  //   const UserRole = this.AccountData.find(user => user.email === email);
  //   this.userRole = UserRole?.role;
  // }
  //   FindEmailAlreadyInUse(email: string) {
  //     console.log(`UserService: 正在驗證 ${email} 是否已被使用...`);
  //     // 在假資料中尋找是否有匹配的 email
  //     const foundUser = this.AccountData.find(user => user.email === email);


  //      if (!foundUser) {
  //       this.EmailExists = false;
  //   }else {
  //     this.EmailExists = true;
  //   }
  // }


  isgoogleclear() {
    this.isgoogleornot = false;
  }

  /**
 * 【新增此方法】設定 App 的通知許可 (由 AppComponent 控制)
 */
  public setAppAllowance(isAllowed: boolean): void {
    this._appAllowsNotifications.next(isAllowed);
    console.log(`[SSE Service] App 權限已設定為: ${isAllowed}`);
  }

  /**
   * 【新增此方法】設定使用者的通知偏好 (由 MainComponent 控制)
   */
  public setUserPreference(isEnabled: boolean): void {
    this._userPrefersNotifications.next(isEnabled);
    localStorage.setItem('sseEnabled', String(isEnabled));
    console.log(`[SSE Service] 使用者偏好已設定為: ${isEnabled}`);
  }

  /** 把純 User64 或 dataURI 轉成可用的 ObjectURL */
  // base64ToObjectURL(base64: string, mime = 'image/png'): string {
  //   // 若已經是 data:image/png;base64,… 直接回傳
  //   if (base64.startsWith('data:')) return base64;


  //   const byteString = atob(base64);
  //   const byteArray = new Uint8Array(
  //     [...byteString].map((char) => char.charCodeAt(0))
  //   );
  //   const blob = new Blob([byteArray], { type: mime });
  //   return URL.createObjectURL(blob);
  // }


  // /** 取得目前登入者的大頭貼（已轉換好的 URL） */
  // get currentAvatar(): string {
  //   const fallbackAvatar = 'https://img.daisyui.com/images/profile/demo/distracted1@192.webp';
  //   const me = this.AccountData.find((u) => u.email === this.myemail);


  //   // 如果找不到使用者，或使用者沒有頭像URL，直接回傳預設圖
  //   if (!me || !me.profilePictureUrl) {
  //     return fallbackAvatar;
  //   }


  //   // ★ 關鍵：先檢查快取中有沒有這個頭像
  //   if (this.avatarCache.has(me.profilePictureUrl)) {
  //     // 如果有，直接從快取回傳，不再重新產生！
  //     return this.avatarCache.get(me.profilePictureUrl)!;
  //   }


  //   // 如果快取中沒有，才進行轉換
  //   // 由於您的頭像都是 'data:' 開頭，我們可以直接用它
  //   // 這邊就不需要再呼叫 base64ToObjectURL
  //   const finalUrl = me.profilePictureUrl;


  //   // ★ 關鍵：將轉換好的結果存入快取，供下次使用
  //   this.avatarCache.set(me.profilePictureUrl, finalUrl);


  //   // 回傳這次轉換的結果
  //   return finalUrl;
  // }


  /**
    * 初始化 SSE 連線 (由 AppComponent 呼叫)
    */
  public initializeSse(): void {
    // 防呆：如果連線已存在，則不重複建立
    if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
      return;
    }
    this.eventSource = new EventSource('http://localhost:8080/sse');

    this.eventSource.onmessage = (event) => {

      const canProcess = this._appAllowsNotifications.getValue() && this._userPrefersNotifications.getValue();

      if (!canProcess || !event.data) {
        return; // 如果任一條件為 false，則直接返回，不處理訊息
      }


      try {
        // 步驟 1: 解析從後端收到的 JSON 資料
        const newProducts: Product[] = JSON.parse(event.data);
        if (!Array.isArray(newProducts) || newProducts.length === 0) return;

        // ★★★【本次最關鍵的新增】步驟 2: 更新 Service 內部的「主要資料快照」★★★
        // 這樣才能確保搜尋結果也能即時更新
        this.updateMerchantDataWithNewProducts(newProducts);
        console.log('[SSE Service] 已將新商品同步至主要資料快照。');

        // 步驟 3: 將【新商品陣列】廣播給 MainComponent 更新輪播區
        this.newProductsSubject.next(newProducts);

        // 步驟 4: 執行您同事的邏輯，更新【全域通知中心】
        const newNotification: SseNotification = {
          id: `sse-${Date.now()}`,
          title: '新折扣登場！',
          items: newProducts.map(p => ({ name: p.foodItemName, price: p.finalPrice })),
          receivedAt: new Date(),
          rawMessage: event.data,
        };
        this._notifications.next([newNotification, ...this._notifications.getValue()]);
        this._unreadCount.next(this._unreadCount.getValue() + 1);

        // 步驟 5: 觸發【全域通知卡片 (Snackbar)】
        const snackbarData: CustomSnackbarData = {
          title: newNotification.title,
          items: newNotification.items,
        };
        this.newSseMessageSubject.next(snackbarData);

      } catch (error) {
        console.error('[SSE Service] 處理訊息時發生錯誤:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('[SSE Service] 連線錯誤:', error);
      this.eventSource?.close();
      this.eventSource = null;
      setTimeout(() => this.initializeSse(), 5000); // 5秒後嘗試重連
    };
  }
  public closeSse(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('[SSE Service] 連線已關閉。');
    }
  }


  /**
   * 切換是否顯示彈出式通知
   */
  public togglePopupNotifications(isEnabled: boolean): void {
    this._showPopupNotifications.next(isEnabled);
    localStorage.setItem('showPopupNotifications', JSON.stringify(isEnabled));
  }

  /**
   * 將所有通知標示為已讀 (重置計數器)
   */
  public markAsRead(): void {
    if (this._unreadCount.getValue() > 0) {
      this._unreadCount.next(0);
    }
  }

  // =======================================================
  // ============== END: 新增的 SSE 通知邏輯 ==============
  // =======================================================

  /**
  * 清除所有通知訊息
  */
  public clearAllNotifications(): void {
    this._notifications.next([]); // 將通知列表設為空陣列
    this._unreadCount.next(0);    // 同時也將未讀計數歸零
    console.log('所有通知已被清除');
  }
  private updateMerchantDataWithNewProducts(newProducts: Product[]): void {
    if (!this.MerchantData) {
      this.MerchantData = [];
    }

    // 為了提高效率，先將新商品按商家 ID 分組
    const productsByMerchant = new Map<number, Product[]>();
    newProducts.forEach(product => {
      const list = productsByMerchant.get(product.merchantId) || [];
      list.push(product);
      productsByMerchant.set(product.merchantId, list);
    });

    // 遍歷分好組的新商品
    productsByMerchant.forEach((products, merchantId) => {
      // 在現有的商家資料中尋找對應的商家
      const existingMerchant = this.MerchantData.find(m => m.merchantsId === merchantId);

      if (existingMerchant) {
        // 如果找到了商家，就更新他的 foodList
        console.log(`[SSE Service] 正在更新商家 ${merchantId} 的商品列表...`);
        products.forEach(newProduct => {
          // 檢查這個新商品是否已經存在於 foodList 中
          const foodIndex = existingMerchant.foodList.findIndex(f => f.id === newProduct.foodItemId);
          if (foodIndex > -1) {
            // 如果已存在，就更新它 (例如價格、數量等)
            // 這裡我們簡單地替換整個物件
            existingMerchant.foodList[foodIndex] = this.mapProductToFooditem(newProduct);
          } else {
            // 如果不存在，就將它新增到列表的開頭
            existingMerchant.foodList.unshift(this.mapProductToFooditem(newProduct));
          }
        });
      } else {
        // 【可選的進階處理】如果連商家都是新的，理論上應該要將新商家也加入到 MerchantData 中。
        // 這個情況在您的「新折扣推播」中比較少見，但為了完整性可以考慮。
        // 目前我們先專注在更新已存在商家的商品。
        console.warn(`[SSE Service] 收到新商品，但找不到對應的商家 ID: ${merchantId}，已忽略。`);
      }
    });
  }

  /**
   * 【新增此輔助方法】
   * 職責：將 SSE 推播的 Product 格式，轉換回 fooditem 格式以便存入 foodList。
   */
  private mapProductToFooditem(product: Product): fooditem {
    return {
      id: product.foodItemId,
      merchantsId: product.merchantId,
      name: product.foodItemName,
      description: product.foodItemDescription,
      imageUrl: product.foodItemImageUrl,
      originalPrice: product.originalPrice,
      discountedPrice: product.finalPrice, // 注意：推播的 finalPrice 才是最新的折扣價
      quantityAvailable: product.quantity || 1, // 假設推播的 quantity 是最新庫存
      pickupStartTime: '', // 這部分資料 SSE 可能沒有，需要根據情況決定如何處理
      pickupEndTime: '',   // 這部分資料 SSE 可能沒有
      category: product.category,
      createdAt: new Date().toISOString(), // 可以用當前時間作為近似值
      updatedAt: new Date().toISOString(),
      active: true,
    };
  }


  /**
  * 檢查儲存在記憶體中的 Access Token 是否仍然有效（未過期）。
  * @returns {boolean} 如果 token 存在且未過期，則回傳 true。
  */
  public isAccessTokenValid(): boolean {
    const token = this.getAccessToken();

    if (!token) {
      return false;
    }

    try {
      const decoded: { exp: number } = jwtDecode(token);
      const expirationDate = new Date(0);
      expirationDate.setUTCSeconds(decoded.exp);
      return expirationDate.valueOf() > new Date().valueOf();
    } catch (error) {
      console.error("解碼 Access Token 時發生錯誤", error);
      return false;
    }
  }

  public startWatchingLocation(): void {
    // 如果已經在監聽了，就不要重複啟動
    if (this.locationWatchId !== null) {
      return;
    }

    // 檢查瀏覽器是否支援
    if (!navigator.geolocation) {
      this.triggerAlertService.trigger('您的瀏覽器不支援地理位置功能。', 'error');
      return;
    }

    console.log('[UserService] 開始監聽使用者位置變化...');

    // 設定選項，要求高精度的位置
    const watchOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000, // 10秒內沒回應就算超時
      maximumAge: 0 // 不使用快取的位置
    };

    this.locationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        console.log('[UserService] 位置已更新:', position.coords);
        const location = {
          lat: position.coords.latitude.toString(),
          lon: position.coords.longitude.toString(),
        };
        // 直接呼叫您現有的 setLocation 方法來更新整個 App 的狀態
        this.setLocation(location);
      },
      (error) => {
        console.error('[UserService] 監聽位置時發生錯誤:', error);

        // 1. 嘗試從 localStorage 讀取舊的位置
        const savedLocationJson = localStorage.getItem('userLocation');

        if (savedLocationJson) {
          // 2. 如果有找到，就使用它
          console.log('[UserService] 監聽失敗，改用 localStorage 的最後位置。');
          // 呼叫您既有的 `loadLocationFromStorage` 方法，它會處理後續的更新
          this.loadLocationFromStorage(); //
          this.triggerAlertService.trigger('無法取得即時位置，已載入您上次的地點。', 'info', 4000);
        } else {
          // 3. 如果連 localStorage 都沒有，才顯示錯誤
          this.triggerAlertService.trigger('無法取得您的位置，請檢查定位權限。', 'error', 4000);
        }
      },
      watchOptions
    );
  }

  // ★ 3. 新增「停止監聽位置」的方法
  public stopWatchingLocation(): void {
    if (this.locationWatchId !== null) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
      console.log('[UserService] 已停止監聽使用者位置。');
    }
  }
  // ★ 2. 新增一個方法，用來取得某個商品在前端購物車中的數量
  public getClientCartItemCount(foodItemId: number): number {
    return this.clientSideCart.filter(item => item.id === foodItemId).length;
  }

  // ★ 3. 新增一個方法，將商品加入到前端購物車
  public addItemToClientCart(item: fooditem): void {
    this.clientSideCart.push(item);
  }

   /**
   * 根據使用者 email 獲取待評論的訂單列表
   * @param email 使用者的電子郵件
   * @returns 一個包含待評論訂單列表的 Observable
   */
  getOrdersToBeReviewed(email: string): Observable<OrdersToReviewRes> {
    const apiUrl = `${this.reviewsApiUrl}/to-be-reviewed/${email}`;
    return this.http.get<OrdersToReviewRes>(apiUrl).pipe(
      catchError(err => {
        console.error('獲取待評論訂單時發生錯誤:', err);
        // 回傳一個包含空列表的成功回應，避免中斷頁面流程
        const emptyResponse: OrdersToReviewRes = {
          code: err.status,
          message: '查詢失敗',
          orders: []
        };
        return of(emptyResponse);
      })
    );
  }
}



