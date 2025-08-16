// in: src/app/merchant-detail/merchant-detail.component.ts

import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UsersServicesService, Merchant, fooditem, Review } from '../@Services/users-services.service';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HttpClientService } from '../@http-services/http.service';
import { TriggerAlertService } from '../@Services/trigger-alert.service';
import { Subscription } from 'rxjs';
// --- 您可能需要從 main.component.ts 複製過來的介面 ---
// 為了方便，我們先在這裡再定義一次。未來可以考慮抽成共用的 a.ts 檔案。
interface Product {
  foodItemId: number;
  merchantId: number;
  foodItemName: string;
  foodItemDescription: string;
  category: string;
  originalPrice: number;
  discountedPrice: number;
  finalPrice: number;
  foodItemImageUrl: string;
  pickupTime: string;
  merchantName: string;
  merchantAddress: string;
  isAdded?: boolean;
  quantity?: number;
}
// ---

@Component({
  selector: 'app-merchant-detail',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink], // 引入所有需要的模組
  templateUrl: './merchant-detail.component.html',
  styleUrls: ['./merchant-detail.component.scss']
})
export class MerchantDetailComponent implements OnInit, OnDestroy {

  merchant: Merchant | null = null;
  isLoading = true;
  selectedProduct: Product | null = null; // 用於「看詳情」的彈出視窗
  private routeSubscription: Subscription | undefined;
  public backUrlPath: string = '/main';
  public backUrlParams: { [key: string]: string } = {};

  // 【新增】用於排序的屬性
  displayedReviews: Review[] = [];
  currentSortOrder: 'recent' | 'highest' | 'lowest' = 'recent'; // 預設為最新

  public formattedOpeningHours: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private usersServicesService: UsersServicesService,
    private triggerAlertService: TriggerAlertService,
    private httpClientService: HttpClientService,// 假設您用這個服務發請求
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    const fullBackUrl = this.usersServicesService.getPreviousUrl(); // 例如拿到 "/main?category=生食"
    const urlParts = fullBackUrl.split('?');
    this.backUrlPath = urlParts[0]; // 結果是 "/main"

    if (urlParts.length > 1) {
      const params = new URLSearchParams(urlParts[1]);
      const paramsObject: { [key: string]: string } = {};
      params.forEach((value, key) => {
        paramsObject[key] = value;
      });
      this.backUrlParams = paramsObject; // 結果是 { category: '生食' }
    }

    this.routeSubscription = this.route.paramMap.subscribe(params => {
      console.log('Route params updated, re-initializing component...');

      // ★ 重新初始化時，確保解除滾動鎖定
      this.resetBodyScroll();

      const merchantIdStr = params.get('id');
      if (merchantIdStr) {
        const merchantId = +merchantIdStr;
        this.loadMerchantDetails(merchantId); // 重新載入資料
      } else {
        this.isLoading = false;
        console.error('網址中沒有提供店家 ID');
      }
    });
  }
  /**
     * 【新增這個方法】
     * 格式化價格 - 加入千分位逗號 (如果您的價格不需要，可以省略)
     * @param price 價格數字
     * @returns 格式化後的價格字串
     */
  formatPrice(price: number): string {
    if (price === undefined || price === null) {
      return '';
    }
    return price.toLocaleString('zh-TW');
  }
  // --- 以下是從 main.component.ts 複製過來並稍作調整的方法 ---

  openFoodItemDetails(item: fooditem): void {
    if (!this.merchant) return; // 確保商家資料已載入

    // 將 fooditem 的資料轉換(映射)成彈出視窗需要的 Product 格式
    const productForModal: Product = {
      foodItemId: item.id,
      merchantId: item.merchantsId,
      foodItemName: item.name,
      foodItemDescription: item.description,
      category: item.category,
      originalPrice: item.originalPrice,
      discountedPrice: item.discountedPrice,
      finalPrice: item.discountedPrice,
      foodItemImageUrl: item.imageUrl,
      pickupTime: `${new Date(item.pickupStartTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} - ${new Date(item.pickupEndTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`,
      merchantName: this.merchant.name,
      merchantAddress: this.merchant.addressText,
      isAdded: false,
      quantity: 1
    };
    this.selectedProduct = productForModal;
    document.body.style.overflow = 'hidden';
  }

  closeProductCard(): void {
    this.selectedProduct = null;
    this.resetBodyScroll();
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
  resetBodyScroll(): void {
    document.body.style.overflow = '';
  }
  /**
   * 智慧「加入購物車」流程
   */
  addToCart(item: fooditem | Product): void {
    // 流程 1: 檢查使用者是否登入
    const isLoggedIn = this.usersServicesService.isLoggedInValue;
    if (!isLoggedIn) {
      this.triggerAlertService.trigger('請先登入才能開始購物喔！', 'info');
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    // 流程 2: 檢查使用者是否有位置資訊
    const userLocation = this.usersServicesService.locationValue;
    if (!userLocation) {
      this.triggerAlertService.trigger('請先設定您的位置，我們才能為您計算距離！', 'info');
      this.router.navigate(['/location'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    // 流程 3: 檢查商家是否有座標
    if (!this.merchant || !this.merchant.longitudeAndLatitude) {

      return;
    }
    // 【修改這裡】修正經緯度的賦值順序
    const coords = this.merchant.longitudeAndLatitude.split(',').map(Number);
    const merchantLon = coords[0]; // 陣列第一個是經度 (Longitude)
    const merchantLat = coords[1]; // 陣列第二個是緯度 (Latitude)

    // 流程 4: 計算距離並驗證
    // 確保 userLocation 不是 null
    if (this.usersServicesService.locationValue) {
      const distance = this.getDistance(
        +this.usersServicesService.locationValue.lat, // 您的緯度
        +this.usersServicesService.locationValue.lon, // 您的經度
        merchantLat,                                  // 商家的緯度
        merchantLon                                   // 商家的經度
      );
      if (distance > 50) {
        this.triggerAlertService.trigger(`太遠了！您距離商家約 ${distance.toFixed(0)} 公里，已超出 50 公里的服務範圍。`, 'error', 5000);
        return;
      }

      // --- 所有檢查通過！執行真正的加入購物車 API 呼叫 ---
      const userEmail = this.usersServicesService.currentUserValue?.email || '';
      const cartData = {
        userEmail: userEmail,
        merchantId: 'merchantsId' in item ? item.merchantsId : item.merchantId, // 處理兩種不同的 item 格式
        foodItemId: 'id' in item ? item.id : item.foodItemId,
        quantity: 1
      };

      console.log('所有驗證通過，發送加入購物車請求:', cartData);
      this.httpClientService.postApi('http://localhost:8080/carts/create', cartData).subscribe({
        next: (res: any) => {
          this.triggerAlertService.trigger(`商品已成功加入購物車！`, 'success');
          if (this.selectedProduct) { this.selectedProduct.isAdded = true; }
        },
        error: (err) => {
          const errorMessage = err.error?.message || '加入購物車失敗，請稍後再試';
          this.triggerAlertService.trigger(errorMessage, 'error');
        }
      });
    }
  }

  loadMerchantDetails(id: number): void {
    this.isLoading = true;
    this.usersServicesService.getMerchantDetails(id).subscribe({
      next: (data) => {
        if (data) {
          this.merchant = data;

          // 檢查並格式化營業時間
          if (this.merchant.opening_hoursDescription) {
            this.formattedOpeningHours = this.formatOpeningHours(this.merchant.opening_hoursDescription);
          }

          this.sortReviews(this.currentSortOrder);
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false; // 發生錯誤，也要隱藏讀取動畫
        this.triggerAlertService.trigger('載入店家資料失敗，請稍後再試', 'error');
        console.error('getMerchantDetails API 發生錯誤', err);
        this.router.navigate(['/main']); // 發生錯誤也導航回列表頁
      }
    });
  }

  ngOnDestroy(): void {
    // 在元件被銷毀時，取消路由訂閱，防止記憶體洩漏
    this.routeSubscription?.unsubscribe();
    // 同時也確保在離開頁面時，解除滾動鎖定
    this.resetBodyScroll();
  }
  /**
   * 計算兩個地理座標點之間的距離（單位：公里）
   */
  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // 地球半徑 (公里)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      0.5 - Math.cos(dLat) / 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      (1 - Math.cos(dLon)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  async shareMerchant(): Promise<void> {
    if (!this.merchant) return;

    const shareData = {
      title: `來看看這家優質店家：${this.merchant.name}`,
      text: `我在 Leftovers 平台上發現了「${this.merchant.name}」，快來看看有什麼好料！`,
      url: window.location.href // 分享當前頁面的網址
    };

    // 檢查瀏覽器是否支援 Web Share API
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        console.log('成功呼叫原生分享！');
      } catch (err) {
        console.error('原生分享失敗:', err);
      }
    } else {
      // 如果不支援，則執行「複製到剪貼簿」的降級方案
      try {
        await navigator.clipboard.writeText(shareData.url);
        this.triggerAlertService.trigger('連結已成功複製到剪貼簿！', 'success');
      } catch (err) {
        console.error('複製連結失敗:', err);
        this.triggerAlertService.trigger('複製連結失敗，請手動複製網址。', 'error');
      }
    }
  }

  sortReviews(order: 'recent' | 'highest' | 'lowest'): void {
    this.currentSortOrder = order;
    if (!this.merchant || !this.merchant.reviews) {
      this.displayedReviews = [];
      return;
    }

    // 建立一個原始評論陣列的複本來進行排序，避免修改原始資料
    const reviewsCopy = [...this.merchant.reviews];

    switch (order) {
      case 'highest':
        reviewsCopy.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest':
        reviewsCopy.sort((a, b) => a.rating - b.rating);
        break;
      case 'recent':
      default:
        reviewsCopy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    this.displayedReviews = reviewsCopy;
  }

  get googleMapsUrl(): string {
    // 步驟 1: 檢查店家資料及經緯度是否存在。這是最重要的資訊。
    // a.ts 中的 Merchant interface 顯示 longitudeAndLatitude 是 string | null
    if (!this.merchant?.longitudeAndLatitude) {
      // 如果沒有店家經緯度，則使用後端提供的 `mapGoogleUrl` 作為最終備案。
      // a.ts 中的 Merchant interface 顯示 mapGoogleUrl 是 string
      return this.merchant?.mapGoogleUrl || '#'; // 返回 '#' 以避免無效連結
    }

    // 步驟 2: 解析店家的經緯度 (邏輯不變)。
    const coords = this.merchant.longitudeAndLatitude.split(',').map(Number);
    const merchantLon = coords[0];
    const merchantLat = coords[1];

    // 步驟 3: 建立一個【只包含目的地】的 Google Maps 路線規劃網址。
    const destination = `${merchantLat},${merchantLon}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  }

  get telLink(): string {
    if (!this.merchant?.phoneNumber) {
      // 如果店家沒有提供電話，回傳一個不會觸發任何動作的連結
      return '#';
    }
    // 使用正規表示式 /\\D/g 移除所有非數字字元
    const cleanPhoneNumber = this.merchant.phoneNumber.replace(/\D/g, '');
    return `tel:${cleanPhoneNumber}`;
  }

  private formatOpeningHours(hoursString: string): string[] {
    if (!hoursString) {
      return ['未提供營業時間'];
    }

    // 使用正規表示式來同時處理全形與半形逗號
    const dayEntries = hoursString.split(/[，,]/).filter(entry => entry.trim() !== '');

    if (dayEntries.length === 0) {
      return [];
    }

    const dailyHours = new Map<string, string>();
    for (const entry of dayEntries) {
      const parts = entry.trim().split(/\s+/);
      if (parts.length === 2) {
        dailyHours.set(parts[0], parts[1].trim() === '未營業' ? '休息' : parts[1].trim());
      }
    }

    if (dailyHours.size === 0) {
      return [];
    }

    const timeToDaysMap = new Map<string, string[]>();
    for (const [day, time] of dailyHours.entries()) {
      if (!timeToDaysMap.has(time)) {
        timeToDaysMap.set(time, []);
      }
      timeToDaysMap.get(time)!.push(day);
    }

    const weekOrder = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
    const resultLines: string[] = [];

    for (const [time, days] of timeToDaysMap.entries()) {
      days.sort((a, b) => weekOrder.indexOf(a) - weekOrder.indexOf(b));
      const formattedDays = this.consolidateDayRanges(days, weekOrder);
      resultLines.push(`${formattedDays}：${time}`);
    }

    return resultLines;
  }

  /**
   * ✅ [複製過來的第二個方法] 輔助函式：將日期陣列轉換為帶有 ~ 和 、 的字串
   */
  private consolidateDayRanges(days: string[], weekOrder: string[]): string {
    if (days.length === 0) return '';
    if (days.length === 1) return days[0];

    const ranges: string[] = [];
    let startIndex = 0;

    for (let i = 1; i <= days.length; i++) {
      if (i === days.length || weekOrder.indexOf(days[i]) !== weekOrder.indexOf(days[i - 1]) + 1) {
        const endIndex = i - 1;
        const startDay = days[startIndex];
        const endDay = days[endIndex];

        if (startIndex === endIndex) {
          ranges.push(startDay);
        } else {
          ranges.push(`${startDay} ~ ${endDay}`);
        }
        startIndex = i;
      }
    }

    return ranges.join('、');
  }

}
