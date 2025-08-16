import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClientService } from '../@http-services/http.service';
import { MerchantsService } from '../@Services/merchants.service';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { UsersServicesService, OrderToReviewVo } from '../@Services/users-services.service';
import { UserVo } from '../@Services/users-services.service';
// 訂單介面定義
export interface Order {
  orderNumber: string;
  userName: string;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  orderDate: Date; // 這是用於所有排序和分組的關鍵屬性
}

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  templateUrl: './order-history.component.html',
  styleUrls: ['./order-history.component.scss']
})
export class OrderHistoryComponent implements OnInit {

  // --- 依賴注入 ---
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private httpClientService = inject(HttpClientService);
  private merchantsService = inject(MerchantsService);

  // --- 靜態屬性 ---
  readonly thisYear = new Date().getFullYear();

  // --- 狀態管理 (Signals) ---
  isThisYearExpanded = signal(false);
  isPastYearsExpanded = signal(false);

  // (修正) 恢復 'months' 狀態，以支援歷年訂單的鑽取
  view = signal<'overview' | 'months' | 'orders'>('overview');
  currentYear = signal<number | undefined>(undefined);
  currentMonth = signal<number | undefined>(undefined);

  // 數據狀態
  storeId = signal<string | undefined>(undefined);
  allOrders = signal<Order[]>([]);
  searchTerm = signal<string>('');

  // RxJS Subject 用於搜尋輸入的防抖
  private searchUpdater = new Subject<string>();

  constructor() {
    this.searchUpdater.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => this.searchTerm.set(term));
  }

  ngOnInit(): void {
    this.route.parent?.paramMap.subscribe(params => {
      const id = params.get('storeId');
      if (id) {
        this.storeId.set(id);
        this.merchantsService.setStoreId(id);
        this.fetchOrders(id);
      }
    });
  }

  // --- 核心數據抓取 ---
  private fetchOrders(merchantId: string): void {
      const d1 = new Date("2025-01-15 14:10:12");
  const d2 = new Date("2025-01-15T14:10:12");

  console.log("d1:", d1); // ← 有時會錯
  console.log("d2:", d2); // ← 一定對
  const apiUrl = `http://localhost:8080/historyOrder/getMerchantUserAllOrder/${merchantId}`;
  this.httpClientService.getApi(apiUrl).subscribe({
    next: (response: any) => {
      console.log('後端回傳訂單：',response);
      if (response?.code === 200 && Array.isArray(response.historyGetMerchantAllOrder)) {

        // ✅ 加入你要的 log
        console.log('🚨 回傳訂單總數：', response.historyGetMerchantAllOrder.length);
        console.table(response.historyGetMerchantAllOrder.map((o: any) => ({
          orderId: o.orderId,
          createdAt: o.createdAt
        })));

        const mappedOrders: Order[] = response.historyGetMerchantAllOrder.map((order: any) => ({
          orderNumber: `${order.orderId}`,
          userName: order.userName,
          totalAmount: order.unitPrice,
          status: order.status ?? '未知狀態',
          paymentMethod: order.paymentMethodSimulated ?? '未提供',
          orderDate: new Date(order.createdAt)
        })).sort((a: Order, b: Order) => b.orderDate.getTime() - a.orderDate.getTime());

        this.allOrders.set(mappedOrders);
      } else {
        this.allOrders.set([]);
      }
    },
    error: (error) => {
      console.error('API 請求失敗:', error);
      this.allOrders.set([]);
    }
  });
}


  // --- 衍生數據 (Computed Signals) ---

  globalSearchResults = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return [];
    return this.allOrders().filter(order => {
      const year = order.orderDate.getFullYear().toString();
      const month = (order.orderDate.getMonth() + 1).toString();
      return (
        year.includes(term) ||
        month.includes(term) ||
        order.orderNumber.toLowerCase().includes(term) ||
        order.userName.toLowerCase().includes(term)
      );
    });
  });

  // (新) 計算選定月份的訂單列表
  ordersForSelectedMonth = computed(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    if (this.view() !== 'orders' || !year || !month) return [];

    return this.allOrders().filter(order =>
      order.orderDate.getFullYear() === year &&
      order.orderDate.getMonth() + 1 === month
    );
  });

  // (新) 計算在「歷年」中選定的某一年份，其包含訂單的月份列表
  monthsForSelectedYear = computed(() => {
    const year = this.currentYear();
    if (this.view() !== 'months' || !year) return [];

    const monthsSet = new Set(
      this.allOrders()
        .filter(order => order.orderDate.getFullYear() === year)
        .map(order => order.orderDate.getMonth() + 1)
    );
    return Array.from(monthsSet).sort((a, b) => b - a);
  });

  pastYears = computed(() => {
    const yearsSet = new Set(this.allOrders().map(order => order.orderDate.getFullYear()));
    return Array.from(yearsSet)
      .filter(year => year !== this.thisYear)
      .sort((a, b) => b - a);
  });

currentYearMonths = computed(() => {
  const orders = this.allOrders();
  const monthsSet = new Set<number>();
  for (const order of orders) {
    const orderYear = order.orderDate.getFullYear();
    if (orderYear === this.thisYear) {
      const month = order.orderDate.getMonth() + 1;
      monthsSet.add(month);
    } else {
      console.log(
        `❌ 不符合條件: orderDate=${order.orderDate.toISOString()}, orderYear=${orderYear}, thisYear=${this.thisYear}`
      );
    }
  }
  console.log('✅ 符合今年的月份：', Array.from(monthsSet));
  return Array.from(monthsSet).sort((a, b) => b - a);
});


  // --- 事件處理與導航函式 ---

  // (新) 導航至指定年份的月份列表 (用於歷年訂單)
  navigateToMonthsForYear(year: number): void {
    this.view.set('months');
    this.currentYear.set(year);
    this.currentMonth.set(undefined); // 清除月份選擇
    this.searchTerm.set('');
  }

  // 導航至指定年月的訂單列表 (用於今年訂單，或從月份列表點擊)
  navigateToOrders(year: number, month: number): void {
    this.view.set('orders');
    this.currentYear.set(year);
    this.currentMonth.set(month);
    this.searchTerm.set('');
  }

  // (新) 統一的返回上一層邏輯
  goBack(): void {
    if (this.view() === 'orders') {
      // 從訂單列表返回
      if (this.currentYear() === this.thisYear) {
        this.view.set('overview'); // 如果是今年的訂單，直接返回概覽
      } else {
        this.view.set('months'); // 如果是歷年訂單，返回到月份列表
      }
      this.currentMonth.set(undefined);
    } else if (this.view() === 'months') {
      // 從月份列表返回概覽
      this.view.set('overview');
      this.currentYear.set(undefined);
    }
  }

  onSearchChange(value: string): void {
    this.searchUpdater.next(value);
    // 如果使用者在任何子畫面中輸入，都應切回概覽頁以顯示全域結果
    if (this.view() !== 'overview' && value) {
      this.view.set('overview');
    }
  }

  toggleThisYear(): void { this.isThisYearExpanded.update(v => !v); }
  togglePastYears(): void { this.isPastYearsExpanded.update(v => !v); }

  // --- 輔助函式 ---
  getMonthName(month: number): string {
    return `${month}月`;
  }
}
