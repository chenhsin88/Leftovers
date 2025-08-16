import { UsersServicesService } from './../@Services/users-services.service';
import { gsap } from "gsap";
import { MatIconModule } from '@angular/material/icon';
import { FoodItemPriceChange, fooditem, Merchant, MerchantApiResponse, fooditemApiResponse } from './../@Services/users-services.service';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { MatSliderModule, MatSliderDragEvent, MatSliderChange } from '@angular/material/slider';
import { Component, ElementRef, signal, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, Subject } from 'rxjs';
import { mergeMap, map, toArray } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { from } from 'rxjs';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { PushNotificationRequest, PushNotificationService } from '../@Services/push-notification.service';
import { HttpClientService } from '../@http-services/http.service';
import { debounceTime } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { take ,filter} from 'rxjs/operators';
import { TriggerAlertService } from '../@Services/trigger-alert.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CustomSnackbarComponent, CustomSnackbarData } from '../custom-snackbar/custom-snackbar.component';
import { CartoMapComponent } from '../components/carto-map/carto-map.component';
import { AiChatComponent } from '../ai-chat/ai-chat.component';
// main.component.ts
interface SearchSuggestion {
  term: string;
  type: 'history' | 'recommendation';
}


// 商品介面定義 (與推播卡片共用)
export interface Product {
  foodItemId: number;
  merchantId: number;
  foodItemName: string;
  foodItemDescription: string;
  category: string;
  subcategory?: string; // 推播卡片有此欄位
  originalPrice: number;
  discountedPrice: number; // 推播卡片也有此欄位
  finalPrice: number;
  foodItemImageUrl: string;
  pickupTime: string;
  merchantName: string;
  merchantAddress: string;
  badge?: string;
  isExpanded?: boolean;
  isAdded?: boolean;
  quantity?: number; // 推播卡片新增的數量欄位，這裡定義為可選
  isPushNotification?: boolean;
  showCheckmark?: boolean;
  quantityAvailable?: number;
}


export interface CartCreateReq {
  userEmail: string;
  merchantId: number;
  foodItemId: number;
  quantity: number;
}


class ActionDebouncer {
  create<T extends any[]>(action: (...args: T) => void, delay = 300): (...args: T) => void {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    return (...args: T) => {
      if (timerId) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(() => {
        action(...args);
      }, delay);
    };
  }
}


@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    MatIconModule,
    RouterModule,
    MatSliderModule,
    ScrollingModule,
    CommonModule,
    FormsModule,
    CartoMapComponent,
    AiChatComponent
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  private queryParamsSubscription!: Subscription;
  private distanceChangeSubscription!: Subscription;
  private distanceChangeDebouncer = new Subject<void>();
  public isSseEnabled: boolean = true;
  private sseSubscription: Subscription | undefined;
  public merchantForFoodModal: Merchant | null = null;

  constructor(
    private usersServicesService: UsersServicesService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private pushNotificationService: PushNotificationService,
    private httpClientService: HttpClientService,
    private triggerAlertService: TriggerAlertService, // 假設這是用來觸發警告的服務
    private snackBar: MatSnackBar,
  ) { }


  public currentFilters = {
    category: '全部',
    sortBy: 'store',
    sortDirection: 'asc',
    searchTerm: '',
    distance: 25
  };


  // private predefinedRecommendations: string[] = ['熱門優惠', '最新上架', '素食專區', '附近餐廳'];
  category: string[] = ['全部', '烘焙', '麻辣', '甜點', '飲品', '生食', '熟食', '盲盒', '素食', '其他'];
  // public suggestions: SearchSuggestion[] = [];
  // public showSuggestions = false;
  // private currentSearchValue = '';
  // ChooseCategory: string = '';
  // private clearSearchSubscription: Subscription | undefined;


  ShowByMap: boolean = false;
  ShowByPricechange: boolean = false;
  selectedCategory = '全部';
  // 【新】控制自動輪播的屬性
  public isAutoplayOn: boolean = true; // 預設開啟
  private intervalId: any; // 用於存放 setInterval 的 ID，以便清除

  filteredMerchants: Merchant[] = [];
  filteredItems: fooditem[] = [];
  // ✨ 1. 新增一個屬性來儲存定時器 ID
  private revalidationInterval: any;
  public showDisclaimer = true; // 預設顯示免責聲明
  public disclaimerAccepted = false; // "我同意" checkbox 的狀態


  sortType = 'asc';
  distance = signal(this.currentFilters.distance);
  isLoading = true;
  allFoodItems: fooditem[] = [];
  mylocation: any;
  private debouncer = new ActionDebouncer();
  productNotifications: Product[] = [];
  displayNotifications: Product[] = []; // 【新】這個陣列才是真正用來顯示在畫面上的

  private scrollSubscription!: Subscription;

  private currentUserSubscription: Subscription | undefined;
  private currentUserEmail: string = '';// 使用者 Email
  private lastLoadedLocation: { lat: string, lon: string } | null = null;

  public skeletons = Array(9).fill(0);
  private locationSubscription: Subscription | undefined;
  private lastLoadedDistance: number = -1;


  @ViewChild('dropdownTrigger') dropdownTrigger!: ElementRef<HTMLAnchorElement>;
  @ViewChild('productsSlider') productsSlider!: ElementRef<HTMLDivElement>; // 新增，用於推播滑動


  ngOnInit(): void {

      this.cleanupSubscriptions();

      document.body.style.overflow='auto';

    //    連線的建立完全由 AppComponent 負責，這裡只管監聽
    this.sseSubscription = this.usersServicesService.newProducts$.subscribe({
      next: (newProducts: Product[]) => {
        console.log('[MainComponent] 從服務收到了新的商品資料，準備更新輪播:', newProducts);
        // ✨【修改點】先過濾掉新商品中可能已過期的項目
        const validNewProducts = this.filterExpiredProducts(newProducts);
        // 更新輪播區的邏輯完全不變
        this.productNotifications = [...newProducts, ...this.productNotifications];
        const uniqueProductsMap = new Map<number, Product>();
        this.productNotifications.forEach(p => uniqueProductsMap.set(p.foodItemId, p));
        this.productNotifications = Array.from(uniqueProductsMap.values());
        this.setupCarouselItems();
        this.cdr.detectChanges();
      }
    });
//     this.usersServicesService.location$.pipe(
//     filter(location => !!location), // << 【主要修改點】只讓非 null 的值通過
//     take(1)
//   ).subscribe(location => {
//     console.log('%c[日誌A - 推播呼叫] 第一次嘗試獲取位置，拿到的值:', 'color: red; font-weight: bold;', location);
//   // 來到這裡的 location 可以保證是有值的
//   if (location) {
//     this.mylocation = location;
//     this.loadData(location, this.currentFilters.distance);
//     this.loadPushNotifications();
//   }
// });
    console.log('[Init] 使用者 Email:', this.usersServicesService.currentUserValue?.email);
    console.log('[Init] 使用者個人資料:', this.usersServicesService.currentUser$);
    console.log('[Init] 商家資料:', this.usersServicesService.MerchantData);

    // const savedHistory = this.loadSearchHistory();
    // console.log('[Init] 搜尋歷史紀錄:', savedHistory);


    this.locationSubscription = this.usersServicesService.location$.subscribe(location => {
      if (location) {
        // 計算新舊位置的距離（簡易版）
        const distanceMoved = this.calculateDistance(this.lastLoadedLocation, location);

        // 只有當第一次載入，或移動超過 500 公尺時才重新 call API
        if (!this.lastLoadedLocation || distanceMoved > 0.5) {
          console.log(`[位置更新] 位置有顯著移動 (${distanceMoved.toFixed(2)}km)，重新載入資料。`);
          this.lastLoadedLocation = location; // 更新最後載入的位置
          this.mylocation = location;
          // this.loadData(location, this.currentFilters.distance);
          // this.loadPushNotifications();
          this.cdr.detectChanges();
        } else {
          console.log('[位置更新] 位置移動距離過小，不重新載入資料。');
        }
      } else {
        console.log('[位置更新] 無位置資料，保持等待狀態');
      }
    });
    this.currentUserSubscription = this.usersServicesService.currentUser$.subscribe(user => {
      this.currentUserEmail = user?.email || '';
      console.log('MainComponent 已取得當前使用者 Email:', this.currentUserEmail);

      // 檢查使用者是否已同意免責聲明
      if (this.currentUserEmail) {
        // 如果使用者已登入，使用與 Email 綁定的鍵
        const storageKey = 'disclaimer_agreed_' + this.currentUserEmail;
        if (localStorage.getItem(storageKey) === 'true') {
          this.showDisclaimer = false;
        } else {
          this.showDisclaimer = true;
          this.preventBodyScroll();
        }
      } else {
        // 如果使用者未登入 (訪客)，可以選擇總是顯示，或使用一個通用的訪客鍵
        // 這裡我們採用最簡單的方式：每次訪客來都重新判斷
        this.showDisclaimer = true;
        this.preventBodyScroll();
      }
    });

    // this.clearSearchSubscription = this.usersServicesService.clearSearch$.subscribe(() => {
    //   console.log('[搜尋] 收到清除搜尋事件');
    //   this.clearsearchInput();
    //   this.clearSearch();

    // });


    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {

      this.ShowByMap = params['priceshowtype'] === 'Map';

      const sortBy = params['sort'] || 'store';
      if (this.ShowByMap) {
        this.currentFilters.sortBy = 'store';

      } else {
        this.currentFilters.sortBy = sortBy;
      }
      this.currentFilters.searchTerm = params['search'] || '';
      this.currentFilters.category = params['category'] || '全部';
      this.selectedCategory = params['category'] || '全部';
      this.currentFilters.sortDirection = params['dir'] || 'asc';
      this.ShowByPricechange = this.currentFilters.sortBy === 'price' && this.currentFilters.sortDirection === 'desc';

      const newDistance = params['distance'] ? +params['distance'] : this.currentFilters.distance;
      this.distance.set(newDistance);

      if (newDistance !== this.lastLoadedDistance) {
        console.log(`[距離改變] ${this.lastLoadedDistance}km → ${newDistance}km`);
        this.usersServicesService.location$.pipe(take(1)).subscribe(location => {
          console.log('%c[日誌B - 店家呼叫] 第二次嘗試獲取位置，拿到的值:', 'color: green; font-weight: bold;', location);
          if (location) {this.mylocation = location; // 順便確保元件屬性被設定
            this.loadData(location, newDistance);
            this.loadPushNotifications(); // << 【關鍵修正】在這裡呼叫推播載入
        }});
      } else {
        console.log('[距離未變] 只在前端更新畫面');
        this.updateItems();
        this.cdr.detectChanges();
      }
    });


    this.distanceChangeSubscription = this.distanceChangeDebouncer.pipe(
      debounceTime(300)
    ).subscribe(() => {
      console.log('[距離防抖] 使用者停止滑動距離 → 呼叫推播 API');
      this.loadPushNotifications(); // 距離改變時重新載入推播
    });
    this.scrollSubscription = this.usersServicesService.scrollToResults$.subscribe(() => {
      this.scrollToResults();
    });

    // ✨ 2. 在 ngOnInit 的最底部，加入這個定時器
    this.revalidationInterval = setInterval(() => {
      console.log('⏳ 每分鐘定時檢查推播商品是否過期...');
      const previouslyVisibleCount = this.displayNotifications.length;

      this.productNotifications = this.filterExpiredProducts(this.productNotifications);
      this.setupCarouselItems(); // 過濾後需要重新設定輪播項目

      // 只有當商品數量真的發生變化時才強制刷新畫面，減少不必要的重繪
      if (this.displayNotifications.length !== previouslyVisibleCount) {
        console.log('發現過期商品，已從輪播中移除。');
        this.cdr.detectChanges();
      }
    }, 60000); // 60000 毫秒 = 1 分鐘

    // this.usersServicesService.startWatchingLocation();
  }

  /**
 * 當用戶點擊「同意並繼續」按鈕時觸發
 */
  public agreeToDisclaimer(): void {
    if (this.disclaimerAccepted) {
      if (this.currentUserEmail) {
        // 如果使用者已登入，使用與 Email 綁定的鍵來儲存
        const storageKey = 'disclaimer_agreed_' + this.currentUserEmail;
        localStorage.setItem(storageKey, 'true');
        console.log(`免責聲明同意狀態已為用戶 ${this.currentUserEmail} 儲存。`);
      } else {
        // 對於未登入的訪客，可以不儲存，或使用通用鍵
        // 這裡我們選擇不為訪客儲存，確保下次訪問或重新整理時會再次顯示
        console.log('訪客同意免責聲明，狀態不進行永久儲存。');
      }

      // 隱藏 Modal
      this.showDisclaimer = false;
      // 恢復頁面滾動
      document.body.style.overflow = '';
    }
  }

  /**
   * 當 Modal 顯示時，禁止背景滾動
   */
  public preventBodyScroll(): void {
    document.body.style.overflow = 'hidden';
  }



  // 載入推播商品 (與之前提供的一致)
  loadPushNotifications(): void {
    if (!this.mylocation || !this.mylocation.lat || !this.mylocation.lon) {
      console.warn('loadPushNotifications 被呼叫，但 mylocation 尚未設定，已中止。');
      return;
    }


    const lat = this.mylocation.lat;
    const lon = this.mylocation.lon;
    const rangeKm = this.distance();
    const category = this.selectedCategory !== '全部' ? this.selectedCategory : null;
    const req: PushNotificationRequest = {
      latitude: lat,
      longitude: lon,
      range: rangeKm,
      category: category
    };


    this.pushNotificationService.getUserUIData(req).subscribe({
      next: (apiResponse: any) => {
        console.log('API 回傳的推播原始資料:', apiResponse);


        let notifications: Product[] = []; // 使用 Product 介面
        if (apiResponse && Array.isArray(apiResponse.pushNotificationTokensUserVo)) {
          // 將接收到的資料映射到 Product 介面
          notifications = apiResponse.pushNotificationTokensUserVo.map((product: any) => ({
            merchantId: product.merchantId, // << 【新增此行】 確保從 API 回應中取得商家 ID
            foodItemId: product.foodItemId,
            foodItemName: product.foodItemName,
            foodItemDescription: product.foodItemDescription,
            category: product.category,
            subcategory: product.subcategory, // 確保有這個字段
            originalPrice: +product.originalPrice,
            discountedPrice: +product.discountedPrice,
            finalPrice: +product.finalPrice,
            foodItemImageUrl: product.foodItemImageUrl,
            pickupTime: product.pickupTime,
            merchantName: product.merchantName,
            merchantAddress: product.merchantAddress,
            isAdded: false, // 初始化為未加入購物車
            quantity: 1, // 初始化數量
            isPushNotification: true // ✅ 重點在這裡
          }));
        }
        // ✨【修改點】在設定 productNotifications 之前，先用我們的過濾函式處理一次
        this.productNotifications = this.filterExpiredProducts(notifications);

        this.productNotifications = notifications;
        console.log('【V3資料清理後】賦值給 productNotifications 的資料:', this.productNotifications);
        this.setupCarouselItems(); // 【新增】呼叫此方法來準備輪播項目

        // 【新增】當資料載入且開關為 on 時，啟動輪播
        if (this.isAutoplayOn) {
          // 使用 setTimeout 確保畫面渲染完成後再啟動
          setTimeout(() => this.startAutoplay(), 100);
        }

        if (this.productNotifications.length > 0) {
          console.log(
            '第一個商品的 originalPrice 型別是:',
            typeof this.productNotifications[0].originalPrice
          );
        }
      },
      error: (err) => {
        console.error('錯誤：無法取得推播商品', err);
        this.productNotifications = [];
      }
    });
  }
  // toggleSseConnection(): void {
  //   // 1. 切換前端的狀態
  //   this.isSseEnabled = !this.isSseEnabled;

  //   // 2. 將設定存入 localStorage
  //   localStorage.setItem('sseEnabled', String(this.isSseEnabled));

  //   // 3. 【重要】呼叫 Service 的方法來設定「是否處理訊息」的閥門
  //   this.usersServicesService.setUserPreference(this.isSseEnabled);
  //   console.log(`[MainComponent] 靜音開關切換，設定 SSE 處理狀態為: ${this.isSseEnabled}`);
  // }


  /**
 * 【新】設定輪播項目，複製開頭的項目到結尾以實現無限輪播
 */
  setupCarouselItems(): void {
    if (this.productNotifications.length < 5) {
      // 如果商品總數太少，直接顯示原始列表即可，不做複製
      this.displayNotifications = [...this.productNotifications];
      return;
    }
    // 複製開頭的 5 個商品
    const itemsToClone = this.productNotifications.slice(0, 5);
    // 組成新的顯示列表 = 原始列表 + 複製的列表
    this.displayNotifications = [...this.productNotifications, ...itemsToClone];
  }




  loadData(location: { lat: string, lon: string }, distance: number): void {
    this.isLoading = true;
    const userLat = +location.lat;
    const userLon = +location.lon;


    this.usersServicesService.getAllMerchants(distance, userLat, userLon).subscribe({
      next: (merchants: Merchant[]) => {
        this.lastLoadedDistance = distance;


        this.allFoodItems = merchants.flatMap(merchant => merchant.foodList || []);
        this.updateItems();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.lastLoadedDistance = distance;
        this.isLoading = false;
        console.error('載入商家與食物資料時發生錯誤:', err);
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * 【新】啟動自動輪播
   */
  /**
   * 【修改】啟動自動輪播，並加入無縫循環邏輯
   */
  startAutoplay(): void {
    this.stopAutoplay();
    if (!this.productsSlider || this.productNotifications.length === 0) return;

    // 假設每個卡片的寬度 + 間距約為 316px (300px寬 + 16px間距)
    // 您可以根據實際情況微調這個數值
    const itemWidth = 316;
    const originalItemsCount = this.productNotifications.length;
    const jumpPoint = originalItemsCount * itemWidth; // 滾動到這個位置時，就該跳轉了

    this.intervalId = setInterval(() => {
      const slider = this.productsSlider.nativeElement;

      // 正常向右滾動
      slider.scrollBy({ left: itemWidth, behavior: 'smooth' });

      // 檢查是否滾動到了複製區
      // 當前滾動位置 + 一個卡片的寬度 > 跳轉點
      if (slider.scrollLeft + itemWidth > jumpPoint) {
        // 當動畫快要結束時，我們在下一次計時器觸發時，瞬間跳回起點
        setTimeout(() => {
          slider.scrollTo({ left: 0, behavior: 'instant' }); // 使用 'instant' 來達成無縫效果
        }, 700); // 700ms 是 'smooth' 滾動動畫的大約時間，請根據情況調整
      }
    }, 3000); // 每 3 秒滾動一次
  }

  /**
   * 【新】停止自動輪播
   */
  stopAutoplay(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  /**
   * 【新】滑鼠移出時，如果開關是開啟的，則恢復輪播
   */
  resumeAutoplay(): void {
    if (this.isAutoplayOn) {
      this.startAutoplay();
    }
  }

  /**
   * 【新】切換自動輪播的開關
   */
  toggleAutoplay(): void {
    this.isAutoplayOn = !this.isAutoplayOn;
    if (this.isAutoplayOn) {
      this.startAutoplay();
      console.log('自動輪播已開啟');
    } else {
      this.stopAutoplay();
      console.log('自動輪播已關閉');
    }
  }


  // clearsearchInput(): void {
  //   this.currentFilters.searchTerm = '';
  //   const searchInputEl = document.querySelector('input[name="search"]') as HTMLInputElement;
  //   if (searchInputEl) {
  //     searchInputEl.value = '';
  //   }
  // }

  // clearSearch(): void {
  //   // 1. 清除顯示在輸入框的文字
  //   const searchInputEl = document.querySelector('input[name="search"]') as HTMLInputElement;
  //   if (searchInputEl) {
  //     searchInputEl.value = '';
  //   }

  //   // 2. 清除內部暫存的搜尋值
  //   this.currentSearchValue = '';
  //   this.showSuggestions = false;

  //   // 3. 更新 URL，將 search 參數移除
  //   //    ngOnInit 中的 queryParams.subscribe 會自動接手後續處理
  //   this.router.navigate([], {
  //     relativeTo: this.route,
  //     queryParams: { search: null },
  //     queryParamsHandling: 'merge'
  //   });
  // }
  updateItems() {
    if (this.allFoodItems.length === 0 || this.usersServicesService.MerchantData.length === 0) {
      console.warn('[updateItems] 資料尚未就緒，跳過更新。');
      this.filteredItems = [];
      this.filteredMerchants = [];
      return;
    }


    if (this.currentFilters.sortBy === 'store' || this.ShowByMap) {
      console.log('模式：依店家或地圖顯示'); // 您可以更新 log 以反映新邏輯
      let tempMerchants: Merchant[] = [...this.usersServicesService.MerchantData];

      if (this.currentFilters.category !== '全部') {
        tempMerchants = tempMerchants.filter(merchant =>
          merchant.foodList.some(food => food.category === this.currentFilters.category)
        );
      }

      if (this.currentFilters.searchTerm) {
        const searchTermLower = this.currentFilters.searchTerm.toLowerCase();
        tempMerchants = tempMerchants.filter(merchant =>
          merchant.name.toLowerCase().includes(searchTermLower) ||
          merchant.foodList.some(food => food.name.toLowerCase().includes(searchTermLower))
        );
      }

      tempMerchants.sort((a, b) => a.name.localeCompare(b.name));

      this.filteredMerchants = tempMerchants; // 確保商家列表有資料
      this.filteredItems = []; // 清空商品列表
      console.log('更新後的店家列表 (for map/list):', this.filteredMerchants);

    } else {
      console.log('模式：依食物/價格顯示');
      let tempFood: fooditem[] = [...this.allFoodItems];


      if (this.currentFilters.searchTerm) {
        const searchTermLower = this.currentFilters.searchTerm.toLowerCase();
        tempFood = tempFood.filter(item =>
          item.name.toLowerCase().includes(searchTermLower)
        );
      }


      if (this.currentFilters.category !== '全部') {
        tempFood = tempFood.filter(item => item.category === this.currentFilters.category);
      }


      if (this.currentFilters.sortBy === 'price') {
        tempFood.sort((a, b) =>
          this.currentFilters.sortDirection === 'asc'
            ? a.discountedPrice - b.discountedPrice
            : b.discountedPrice - a.discountedPrice
        );
      } else if (this.currentFilters.sortBy === 'food') {
        tempFood.sort((a, b) => a.name.localeCompare(b.name));
      }


      this.filteredItems = tempFood;
      this.filteredMerchants = [];
      console.log('更新後的食物列表:', this.filteredItems);
    }
  }

  /**
    * 當使用者點擊「查看店家」按鈕時觸發
    * @param merchant 被點擊的商家物件
    */
  viewStore(merchant: Merchant): void {
    this.usersServicesService.setPreviousUrl(this.router.url);
    this.router.navigate(['/merchant', merchant.merchantsId]);
  }
  /**
   * 【新增的方法】
   * 當使用者點擊「看詳情」按鈕時觸發
   * @param item 被點擊的食物物件 (來自 filteredItems)
   */
  openFoodItemDetails(item: fooditem): void {
    // 1. 從完整的商家列表中，根據 merchantsId 找到對應的商家資訊
    const merchant = this.usersServicesService.MerchantData.find(m => m.merchantsId === item.merchantsId);

    // 2. 將 fooditem 的資料轉換(映射)成彈出視窗需要的 Product 格式
    const productForModal: Product = {
      foodItemId: item.id,
      merchantId: item.merchantsId, // << 傳入 merchantId
      foodItemName: item.name,
      foodItemDescription: item.description,
      category: item.category,
      originalPrice: item.originalPrice,
      discountedPrice: item.discountedPrice,
      finalPrice: item.discountedPrice, // 在這個情境下，finalPrice 等於 discountedPrice
      foodItemImageUrl: item.imageUrl,
      pickupTime: `${new Date(item.pickupStartTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} - ${new Date(item.pickupEndTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`,
      merchantName: merchant ? merchant.name : '未知店家',
      merchantAddress: merchant ? merchant.addressText : '未知地址',
      isAdded: false,
      quantity: 1,
      isPushNotification: false // ✅ 重點在這
    };

    // 3. 設定 selectedProduct 來觸發彈出視窗
    this.selectedProduct = productForModal;
    document.body.style.overflow = 'hidden'; // 防止背景滾動
  }

  togglePriceSort(): void {
    const nextSortDir = (this.currentFilters.sortBy !== 'price' || this.currentFilters.sortDirection === 'asc')
      ? 'desc'
      : 'asc';


    const queryParams = {
      sort: 'price',
      dir: nextSortDir
    };


    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge'
    });
  }


  updateDisplayValue(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.distance.set(parseInt(value, 10));
    this.distanceChangeDebouncer.next(); // 觸發防抖
  }


  onDragEnd(event: MatSliderDragEvent): void {
    this.isLoading = true; // 1. 立刻顯示載入中動畫
    if (this.dropdownTrigger) {
      this.dropdownTrigger.nativeElement.blur(); // 2. 讓選單失去焦點，它就會自動關閉
    }
    const finalDistance = event.source.value;
    this.debouncedUpdateDistance(finalDistance);


    if (this.dropdownTrigger) {
      this.dropdownTrigger.nativeElement.blur();
    }
  }
  private debouncedUpdateDistance = this.debouncer.create((distance: number) => {
    this.router.navigate([], {
      queryParams: { distance: distance },
      queryParamsHandling: 'merge'
    });
  }, 400);


  formatLabel(value: number): string {
    return `${value}km`;
  }


  categorychoose(type: string) {
    // 您的類別選擇邏輯
  }


  ngOnDestroy(): void {
    this.cleanupSubscriptions();
  }


  // updateSuggestions(event?: Event): void {
  //   this.showSuggestions = true;
  //   const inputElement = event?.target as HTMLInputElement;

  //   const currentValue = inputElement?.value || ''; // 取得輸入框的即時值
  //     if (currentValue === '' && this.currentFilters.searchTerm) {
  //     this.clearSearch();
  //     return; // 清除後，直接結束此函式，不顯示搜尋建議
  //   }

  //   this.currentSearchValue = inputElement?.value.trim() || '';
  //   const history = this.loadSearchHistory();


  //   const recommendations = this.predefinedRecommendations
  //     .filter(term =>
  //       !history.some(h => h.term === term) &&
  //       term.toLowerCase().includes(this.currentSearchValue.toLowerCase())
  //     )
  //     .map(term => ({ term, type: 'recommendation' } as SearchSuggestion));


  //   this.suggestions = [...history, ...recommendations];
  // }


  // onSearch(): void {
  //    if (this.currentSearchValue) {
  //     this.saveSearchTerm(this.currentSearchValue);
  //     this.showSuggestions = false;
  //     console.log('正在搜尋:', this.currentSearchValue);
  //     this.router.navigate([], {
  //       queryParams: { search: this.currentSearchValue },
  //       queryParamsHandling: 'merge'
  //     });
  //     this.scrollToResults();
  //   } else {
  //     // 如果使用者在空的輸入框按 Enter，也視為清除搜尋
  //     this.clearSearch();
  //   }
  // }

  scrollToResults(): void {
    // 使用 setTimeout 是為了確保在 Angular 完成畫面渲染後才執行滾動
    // 給予 100 毫秒的延遲，讓體驗更穩定
    setTimeout(() => {
      const resultsElement = document.getElementById('searchResultsContainer');
      if (resultsElement) {
        resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  // private saveSearchTerm(term: string): void {
  //   let history = this.loadSearchHistory();
  //   history = history.filter(item => item.term !== term);
  //   history.unshift({ term, type: 'history' });
  //   if (history.length > 10) history.pop();
  //   localStorage.setItem('searchHistory', JSON.stringify(history));
  // }


  // private loadSearchHistory(): SearchSuggestion[] {
  //   const historyData = localStorage.getItem('searchHistory');
  //   return historyData ? JSON.parse(historyData) : [];
  // }


  // applySuggestion(suggestion: SearchSuggestion): void {
  //   const inputElement: HTMLInputElement | null = document.querySelector('input[name="search"]');
  //   if (inputElement) {
  //     this.currentSearchValue = suggestion.term;
  //     inputElement.value = suggestion.term;
  //     this.onSearch();
  //   }
  // }


  // hideSuggestionsWithDelay(): void {
  //   setTimeout(() => { this.showSuggestions = false; }, 200);
  // }


  // get hasHistoryItems(): boolean {
  //   return this.suggestions.some(s => s.type === 'history');
  // }


  // get hasRecommendationItems(): boolean {
  //   return this.suggestions.some(s => s.type === 'recommendation');
  // }


  // get historyItems(): SearchSuggestion[] {
  //   return this.suggestions.filter(s => s.type === 'history');
  // }


  // get recommendationItems(): SearchSuggestion[] {
  //   return this.suggestions.filter(s => s.type === 'recommendation');
  // }
  // removeHistoryItem(event: MouseEvent, termToRemove: string): void {
  //   event.stopPropagation();
  //   this.suggestions = this.suggestions.filter(s => s.term !== termToRemove);
  //   let history = this.loadSearchHistory();
  //   history = history.filter(item => item.term !== termToRemove);
  //   localStorage.setItem('searchHistory', JSON.stringify(history));
  // }


  // --- 商品推播列表方法 (新加入並調整以符合 main.component 結構) ---


  // 當前選中的商品（用於浮出卡片）
  selectedProduct: Product | null = null;


  /**
   * 格式化價格 - 加入千分位逗號
   * @param price 價格數字
   * @returns 格式化後的價格字串
   */
  formatPrice(price: number): string {
    return price.toLocaleString('zh-TW');
  }


  /**
   * 滾動商品
   * @param direction 滾動方向 (-1 為左，1 為右)
   */
  scrollProducts(direction: number): void {
    const slider = this.productsSlider.nativeElement;
    const scrollAmount = 300; // 每次滾動的像素量
    slider.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
  }


  /**
   * 開啟商品浮出卡片
   * @param product 被點擊的商品
   * @param event 點擊事件
   */
  openProductCard(product: Product, event: Event): void {
    event.stopPropagation(); // 阻止事件冒泡到父元素
    this.selectedProduct = { ...product }; // 複製一份，避免直接修改原始數據
    document.body.style.overflow = 'hidden'; // 防止背景滾動
  }


  /**
   * 關閉商品浮出卡片
   */
  closeProductCard(): void {
    this.selectedProduct = null;
    document.body.style.overflow = ''; // 恢復背景滾動
  }


  /**
   * 阻止卡片內部點擊事件冒泡 (與原版重複，但保留以確保行為)
   * @param event 點擊事件
   */
  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  /**
  * ✨【修正版】過濾掉 pickupEndTime 已過期的商品
  * @param products 商品陣列
  * @returns 未過期的商品陣列
  */
  private filterExpiredProducts(products: Product[]): Product[] {
    const now = new Date(); // 取得當前時間

    return products.filter(product => {
      // 1. 檢查商品是否有 pickupEndTime 這個欄位
      if (!product.pickupTime) {
        console.warn(`商品 "${product.foodItemName}" 缺少 pickupEndTime 資訊，無法進行過濾。`);
        return true; // 如果沒有截止時間資訊，為安全起見，暫不將其過濾
      }

      try {
        // 2. 直接將後端提供的完整時間字串轉換為 Date 物件
        const deadline = new Date(product.pickupTime);

        // 3. 驗證轉換後的日期是否有效
        if (isNaN(deadline.getTime())) {
          console.warn(`商品 "${product.foodItemName}" 的 pickupEndTime 格式無效: ${product.pickupTime}`);
          return true; // 格式無效，不過濾
        }

        // 4. 比較當前時間和商品的截止時間
        // 如果當前時間 < 截止時間，則保留該商品
        return now < deadline;

      } catch (error) {
        console.error(`處理商品 "${product.foodItemName}" 的截止時間時發生錯誤`, error);
        return true; // 處理出錯時，不過濾
      }
    });
  }

  /**
 * 最終版的「加入購物車」方法
 * @param item - 可以是 fooditem 或 Product 類型的物件
 */
  public addToCart(item: fooditem | Product): void {
    // 檢查登入 (維持不變)
    const isLoggedIn = this.usersServicesService.isLoggedInValue;
    if (!isLoggedIn) {
      this.triggerAlertService.trigger('請先登入才能開始購物喔！', 'info');
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    // ★ 1. 透過 'in' 運算子，安全地取得商品名稱 ★
    const itemName = 'name' in item ? item.name : item.foodItemName;

    // 庫存檢查邏輯
    const quantityAvailable = 'quantityAvailable' in item ? item.quantityAvailable : 999;
    if (quantityAvailable === null || quantityAvailable === undefined) {
      this.triggerAlertService.trigger('無法確認商品庫存，請稍後再試。', 'error');
      return;
    }

    const itemId = 'id' in item ? item.id : item.foodItemId;
    const currentCountInCart = this.usersServicesService.getClientCartItemCount(itemId);

    // ★ 2. 在提示訊息中使用剛剛取得的 itemName ★
    if (currentCountInCart >= quantityAvailable) {
      this.triggerAlertService.trigger(`抱歉，「${itemName}」的庫存只剩下 ${quantityAvailable} 件喔！`, 'warning');
      return;
    }

    // --- 後續程式碼維持不變 ---

    const userEmail = this.usersServicesService.currentUserValue?.email || '';
    const cartData = {
      userEmail: userEmail,
      merchantId: 'merchantsId' in item ? item.merchantsId : item.merchantId,
      foodItemId: itemId,
      quantity: 1
    };

    this.httpClientService.postApi('http://localhost:8080/carts/create', cartData).subscribe({
      next: (res: any) => {
        this.usersServicesService.addItemToClientCart(item as fooditem);
        this.triggerAlertService.trigger(`商品已成功加入購物車！`, 'success');

        item.showCheckmark = true;
        this.cdr.detectChanges();
        setTimeout(() => {
          item.showCheckmark = false;
          this.cdr.detectChanges();
        }, 1500);
      },
      error: (err) => {
        const errorMessage = err.error?.message || '加入購物車失敗，請稍後再試';
        this.triggerAlertService.trigger(errorMessage, 'error');
      }
    });
  }
  private calculateDistance(loc1: { lat: string, lon: string } | null, loc2: { lat: string, lon: string }): number {
    if (!loc1) return Infinity; // 如果沒有舊位置，強制更新

    const R = 6371; // 地球半徑 (km)
    const dLat = (parseFloat(loc2.lat) - parseFloat(loc1.lat)) * Math.PI / 180;
    const dLon = (parseFloat(loc2.lon) - parseFloat(loc1.lon)) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(parseFloat(loc1.lat) * Math.PI / 180) * Math.cos(parseFloat(loc2.lat) * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public onMapPinClicked(merchant: Merchant): void {
    this.openFoodListModal(merchant);
  }

  // ★ 3. 我們還需要一個關閉這個新彈窗的方法
  public closeFoodListModal(): void {
    this.merchantForFoodModal = null;
    document.body.style.overflow = ''; // 恢復背景滾動
  }
  public openFoodListModal(merchant: Merchant): void {
    if (!merchant.foodList || merchant.foodList.length === 0) {
      this.triggerAlertService.trigger('此店家目前沒有可顯示的食物。', 'info');
      return;
    }
    this.merchantForFoodModal = merchant;
    document.body.style.overflow = 'hidden';
  }

  cleanupSubscriptions(){
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
    // if (this.clearSearchSubscription) {
    //   this.clearSearchSubscription.unsubscribe();
    // }
    if (this.locationSubscription) { // 取消位置訂閱
      this.locationSubscription.unsubscribe();
    }
    if (this.distanceChangeSubscription) { // 取消距離防抖訂閱
      this.distanceChangeSubscription.unsubscribe();
    }
    if (this.currentUserSubscription) {
      this.currentUserSubscription.unsubscribe();
    }
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
    }
    if (this.sseSubscription) {
      this.sseSubscription.unsubscribe();
    }
    this.usersServicesService.stopWatchingLocation();
    // 【新增】在元件銷毀時，確保停止輪播
    this.stopAutoplay();
    // ✨ 3. 在元件銷毀時，務必清除定時器，避免記憶體洩漏
    if (this.revalidationInterval) {
      clearInterval(this.revalidationInterval);
    }
  }
}
