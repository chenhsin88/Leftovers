// app.component.ts

import { MainComponent } from './main/main.component'; // 確保這個 MainComponent 在 imports 中是必要的
import { Component, ViewChild, ElementRef, ViewChildren, QueryList, HostListener } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, RouterLink } from '@angular/router';

import { gsap } from "gsap";
import { MatIconModule } from '@angular/material/icon';
// import { NgModule } from '@angular/core'; // 如果此檔案不是 NgModule，這個 import 可以移除
import { FormsModule } from '@angular/forms';
// import { ScrollTrigger } from "gsap/ScrollTrigger"; // 如果這個元件沒有直接使用 ScrollTrigger，可以移除
import { filter, map, startWith } from 'rxjs/operators';
import { UsersServicesService, SseNotification } from './@Services/users-services.service';
import { AlertComponent } from "./alert/alert.component";
import { AiChatComponent } from './ai-chat/ai-chat.component';
import { Observable, Subscription, combineLatest } from 'rxjs';
import { SafeUrlPipe } from './safe-url.pipe';
import { HttpClientModule } from '@angular/common/http';
// import { appConfig } from './app.config'; // 如果您不需要在這裡直接使用 appConfig，可以移除
// import { bootstrapApplication } from '@angular/platform-browser'; // 如果您不需要在這裡直接使用 bootstrapApplication，可以移除
import { CommonModule } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CustomSnackbarComponent, CustomSnackbarData } from './custom-snackbar/custom-snackbar.component';
import { MatButtonModule } from '@angular/material/button';

// 搜尋建議介面定義
export interface SearchSuggestion {
  term: string;
  type: 'history' | 'recommendation';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatIconModule, FormsModule, AlertComponent, SafeUrlPipe, HttpClientModule, CommonModule, MatSnackBarModule, RouterLink, AiChatComponent, MatButtonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {

  title = 'leftovers';
  isLoggedIn: boolean = false;
  TitleAndFooterNeed: boolean = true;
  // IconShowOrNot 在新的 Header 設計中不再有實際視覺效果的控制，可以移除其所有相關邏輯
  IconShowOrNot: boolean = false; // 此變數將不再用於 Header 顯示邏輯
  LightDarkContolIsChoose: boolean = false; // 控制深淺模式
  avatarUrl: string | null = '';
  userName: string | null = null;
  userRole: string | null = null;

  private userSub: Subscription | undefined;
  private authSub: Subscription | undefined;
  private authSubscription: Subscription | undefined;
  private routerSubscription: Subscription | undefined;
  private userSubscription: Subscription | undefined;

  // START: 新增的屬性
  public notifications$: Observable<SseNotification[]>;
  public unreadCount$: Observable<number>;
  public showPopups$: Observable<boolean>;
  private sseSubscription: Subscription | undefined; // <-- 新增 SSE 訊息的訂閱
  private sseControlSubscription: Subscription | undefined;

  public isLiveUpdateEnabled: boolean = true;
  // END: 新增的屬性

  // 搜尋相關變數
  public isMainPage: boolean = false; // 用於觸發 main component 的滾動
  public suggestions: SearchSuggestion[] = [];
  public showSuggestions = false;
  public currentSearchValue = '';
  private predefinedRecommendations: string[] = ['熱門優惠', '最新上架', '素食專區', '附近餐廳'];

  public isLoadingApp$: Observable<boolean>; // 應用程式載入狀態


  constructor(
    private router: Router,
    private userService: UsersServicesService,
    private snackBar: MatSnackBar

  ) {
    this.isLoadingApp$ = this.userService.appLoading$;
    this.isLoadingApp$ = this.userService.appLoading$;
    this.notifications$ = this.userService.notifications$;
    this.unreadCount$ = this.userService.unreadCount$;
    this.showPopups$ = this.userService.showPopupNotifications$;
    const savedLiveUpdatePref = localStorage.getItem('liveUpdateEnabled');
    this.isLiveUpdateEnabled = savedLiveUpdatePref !== 'false';
    this.userService.setUserPreference(this.isLiveUpdateEnabled);
  }

  // 定錨向上滾動鈕
  showScrollToTopButton: boolean = false;


  // ✅ [新增] 加上 HostListener 來監聽 window 的捲動事件
  @HostListener('window:scroll', [])
  onWindowScroll() {
    // 當垂直捲動距離大於 200px 時顯示按鈕，否則隱藏
    if (window.pageYOffset > 200) {
      this.showScrollToTopButton = true;
    } else {
      this.showScrollToTopButton = false;
    }
  }

  // ✅ [新增] 新增一個回到頂部的方法
  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth' // 使用平滑捲動效果
    });
  }

  ngOnInit(): void {
    // 訂閱使用者基本資料 (名稱、角色)
    this.userSub = this.userService.currentUser$.subscribe(user => {
      this.userName = user ? user.name : null;
      this.userRole = user ? user.role : null;
    });

    // 訂閱登入狀態
    this.authSubscription = this.userService.isLoggedIn$.subscribe(status => {
      this.isLoggedIn = status;
    });

    // 訂閱使用者完整資料 (用於取得頭像 URL、再次確認名稱)
    this.userSubscription = this.userService.currentUser$.subscribe(user => {
      if (user) {
        this.avatarUrl = user.profilePictureUrl;
        this.userName = user.name;
      } else {
        // 登出時清空資料
        this.avatarUrl = null;
        this.userName = null;
      }
    });


    // ===================================================================
    // ======================= START: 核心修正區塊 =======================
    // ===================================================================
    // 訂閱登入狀態，並在登入後觸發 SSE 初始化
    this.authSubscription = combineLatest([
      this.userService.isLoggedIn$,
      this.userService.currentUser$
    ]).subscribe(([isLoggedIn, user]) => {

      this.isLoggedIn = isLoggedIn;
      const userIsCustomer = user ? user.role === 'customer' : false;

      // 【新的連線條件】: 必須登入，且角色必須是 'customer'
      if (isLoggedIn && userIsCustomer) {
        console.log('[AppComponent] 偵測到顧客登入，正在初始化 SSE 連線...');
        this.userService.initializeSse();

        // 訂閱彈窗提醒的邏輯保持不變
        if (!this.sseSubscription) {
          this.sseSubscription = this.userService.newSseMessage$.subscribe(data => {
            if (this.userService['_showPopupNotifications'].getValue()) {
              this.showCustomSnackbar(data);
            }
          });
        }
      } else {
        // 任何不滿足條件的情況 (未登入、非顧客角色)，都確保連線是關閉的
        console.log('[AppComponent] 狀態不滿足 (未登入或非顧客)，正在關閉 SSE 連線...');
        this.userService.closeSse();
      }
    });
    // ===================================================================
    // ======================== END: 核心修正區塊 ========================
    // ===================================================================

    // 監聽路由變化，控制 Header/Footer 顯示和搜尋框值
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // 【修改 A】: 從完整 URL 中，只取出路徑部分 (忽略 '?' 後的所有內容)
      const fullUrl = event.urlAfterRedirects;
      const baseUrl = fullUrl.split('?')[0];

      // 這個判斷式只會影響 isMainPage，決定【搜尋框】是否顯示
      const mainPageUrls = ['/main', '/'];
      // 使用 baseUrl 進行比對，更為簡潔
      this.isMainPage = mainPageUrls.some(mainUrl => baseUrl === mainUrl);

      // 【修改 B】: 清理 noHeaderFooterRoutes 陣列，移除帶有查詢參數的項目
      const noHeaderFooterRoutes = [
        '/',
        '/login',
        '/signup',
        '/location',
        '/firstshowpage',
        '/storeList',
        '/payment-result'
      ];

      // 【修改 C】: 使用 baseUrl 進行精確比對，完美解決問題
      this.TitleAndFooterNeed = !noHeaderFooterRoutes.some(route => baseUrl === route);

      // 當路由變化時，更新搜尋框的值
      if (this.isMainPage) {
        const urlParams = new URLSearchParams(fullUrl.split('?')[1]);
        this.currentSearchValue = urlParams.get('search') || '';
      } else {
        this.currentSearchValue = ''; // 離開主頁時清空搜尋框
      }
    });
    // --- START: 新增的、獨立的 SSE 控制邏輯 ---
    const isOnMerchantPage$ = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects.startsWith('/merchant')),
      startWith(this.router.url.startsWith('/merchant'))
    );

    this.sseControlSubscription = combineLatest([
      this.userService.isLoggedIn$,
      this.userService.currentUser$,
      isOnMerchantPage$
    ]).pipe(
      map(([isLoggedIn, user, onMerchantPage]) => {
        const userIsCustomer = user ? user.role === 'customer' : false;
        return isLoggedIn && userIsCustomer && !onMerchantPage;
      })
    ).subscribe(canProcess => {
      this.userService.setAppAllowance(canProcess);
    });
    // --- END: 新增的邏輯 ---
  }

  /**
   * 呼叫服務以清除所有通知
   */
  clearNotifications(): void {
    this.userService.clearAllNotifications();
  }

  // START: 新增的方法
  private showCustomSnackbar(data: CustomSnackbarData): void {
    this.snackBar.openFromComponent(CustomSnackbarComponent, {
      data: data,
      duration: 10000,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
      panelClass: ['custom-snackbar-container']
    });
  }

  markNotificationsAsRead(): void {
    this.userService.markAsRead();
  }

  togglePopupNotifications(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.userService.togglePopupNotifications(input.checked);
  }
  // END: 新增的方法

  // 登出方法
  logout(): void {
    this.userService.LoginOutNow();
  }

  // 導航到主頁，並觸發搜尋清除和滾動
  navigateToMain(): void {
    this.router.navigate(['/main']);
    this.userService.triggerClearSearch(); // 觸發 main.component 中的清除搜尋並滾動到結果
  }

  // 深淺模式切換邏輯 (保留了 GSAP 動畫)
  LightDarkContolison() {
    this.LightDarkContolIsChoose = !this.LightDarkContolIsChoose;

    if (this.LightDarkContolIsChoose) {
      gsap.to("#Sun", {
        duration: 0.4,
        opacity: 0,
        scale: 0.7,
        rotation: -90,
        ease: "power1.in",
        force3D: true,
        overwrite: "auto"
      });
      gsap.fromTo("#Moon",
        {
          opacity: 0,
          scale: 0.5,
          rotation: 90,
          y: 20
        },
        {
          duration: 0.5,
          opacity: 1,
          scale: 1,
          rotation: 0,
          y: 0,
          ease: "back.out(1.7)",
          force3D: true,
          overwrite: "auto",
          delay: 0.1
        }
      );
    } else {
      gsap.to("#Moon", {
        duration: 0.4,
        opacity: 0,
        scale: 0.7,
        rotation: 90,
        ease: "power1.in",
        force3D: true,
        overwrite: "auto"
      });
      gsap.fromTo("#Sun",
        {
          opacity: 0,
          scale: 0.5,
          rotation: -90,
          y: 20
        },
        {
          duration: 0.5,
          opacity: 1,
          scale: 1,
          rotation: 0,
          y: 0,
          ease: "back.out(1.7)",
          force3D: true,
          overwrite: "auto",
          delay: 0.1
        }
      );
    }
  }

  // 導航到使用者訂單頁面
  goToUserOrders() {
    if (this.userName) {
      this.router.navigate([`/userOrders/${this.userName}`]);
    } else {
      this.router.navigate(['/login']);
    }
  }

  // 導航到使用者個人資料頁面
  GoToChange(): void {
    // 在跳轉頁面前，讓當前活動元素失去焦點，這會自動關閉 dropdown
    (document.activeElement as HTMLElement)?.blur();

    // 接著執行原本的頁面跳轉邏輯
    this.router.navigate(['/profile-edit']);
  }

  // 導航到 FAQ 頁面
  // goToFaq() {
  //   this.router.navigate(['/faq']);
  // }

  // 導航到購物車頁面
  goToCart() {
    if (this.isLoggedIn && this.userName) {
      this.router.navigate([`/cart/${this.userName}`]);
    } else {
      this.router.navigate(['/login']);
    }
  }

  // 搜尋建議相關邏輯 (與之前版本相同)
  updateSuggestions(event?: Event): void {
    const inputElement = event?.target as HTMLInputElement;
    if (!inputElement) return;


    this.currentSearchValue = inputElement.value.trim();
    this.showSuggestions = true;
    const history = this.loadSearchHistory();

    const filteredHistory = history.filter(item =>
      item.term.toLowerCase().includes(this.currentSearchValue.toLowerCase())
    );

    const recommendations = this.predefinedRecommendations
      .filter(term =>
        !history.some(h => h.term === term) &&
        term.toLowerCase().includes(this.currentSearchValue.toLowerCase())
      )
      .map(term => ({ term, type: 'recommendation' } as SearchSuggestion));

    this.suggestions = [...filteredHistory, ...recommendations];
  }

  onSearch(): void {
    if (this.currentSearchValue) {
      this.saveSearchTerm(this.currentSearchValue);
      this.router.navigate(['/main'], {
        queryParams: { search: this.currentSearchValue },
        queryParamsHandling: 'merge'
      });
      this.userService.triggerScrollToResults();
    } else {
      this.clearSearch();
    }
    this.showSuggestions = false;
  }

  clearSearch(): void {
    this.currentSearchValue = '';
    const searchInput = document.querySelector('input[name="search"]') as HTMLInputElement;
    if (searchInput) searchInput.value = '';

    this.router.navigate(['/main'], {
      queryParams: { search: null },
      queryParamsHandling: 'merge'
    });
  }

  applySuggestion(suggestion: SearchSuggestion): void {
    const inputElement: HTMLInputElement | null = document.querySelector('input[name="search"]');
    if (inputElement) {
      inputElement.value = suggestion.term;
      this.currentSearchValue = suggestion.term;
      this.onSearch();
    }
  }

  hideSuggestionsWithDelay(): void {
    setTimeout(() => { this.showSuggestions = false; }, 200);
  }

  removeHistoryItem(event: MouseEvent, termToRemove: string): void {
    event.stopPropagation();
    this.suggestions = this.suggestions.filter(s => s.term !== termToRemove);
    let history = this.loadSearchHistory();
    history = history.filter(item => item.term !== termToRemove);
    localStorage.setItem('searchHistory', JSON.stringify(history));
  }

  private saveSearchTerm(term: string): void {
    let history = this.loadSearchHistory();
    history = history.filter(item => item.term !== term);
    history.unshift({ term, type: 'history' });
    if (history.length > 10) history.pop();
    localStorage.setItem('searchHistory', JSON.stringify(history));
  }

  private loadSearchHistory(): SearchSuggestion[] {
    const historyData = localStorage.getItem('searchHistory');
    return historyData ? JSON.parse(historyData) : [];
  }

  get hasHistoryItems(): boolean {
    return this.suggestions.some(s => s.type === 'history');
  }

  get hasRecommendationItems(): boolean {
    return this.suggestions.some(s => s.type === 'recommendation');
  }

  get historyItems(): SearchSuggestion[] {
    return this.suggestions.filter(s => s.type === 'history');
  }

  get recommendationItems(): SearchSuggestion[] {
    return this.suggestions.filter(s => s.type === 'recommendation');
  }

  // 在元件銷毀時取消所有訂閱，防止記憶體洩漏
  ngOnDestroy(): void {
    if (this.authSubscription) this.authSubscription.unsubscribe();
    if (this.routerSubscription) this.routerSubscription.unsubscribe();
    if (this.userSubscription) this.userSubscription.unsubscribe();
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
    if (this.sseSubscription) this.sseSubscription.unsubscribe(); // <-- 新增
    // 新增的清理邏輯
    if (this.sseControlSubscription) {
      this.sseControlSubscription.unsubscribe();
    }
  }
  toggleLiveUpdates(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.isLiveUpdateEnabled = input.checked;
    localStorage.setItem('liveUpdateEnabled', String(this.isLiveUpdateEnabled));
    this.userService.setUserPreference(this.isLiveUpdateEnabled);
    console.log(`[AppComponent] 即時更新開關切換，設定使用者偏好為: ${this.isLiveUpdateEnabled}`);
  }
}
