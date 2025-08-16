import { UsersServicesService } from './../@Services/users-services.service';
import { CommonModule, DOCUMENT, CurrencyPipe } from '@angular/common';
import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClientService } from '../@http-services/http.service';
import { FormsModule } from '@angular/forms';
import { TriggerAlertService } from '../@Services/trigger-alert.service';
import { switchMap, map } from 'rxjs/operators';
import { throwError } from 'rxjs';
// 購物車商品介面定義
export interface CartItem {
  id: number;
  storeName: string;
  productName: string;
  price: number;
  quantity: number;
  image: string;
  selected: boolean;
  merchantId: number;
}

// 後端 /orders/create 回應的資料介面
interface OrderCreateResponse {
  code: number;
  message: string;
  orderId: number;
}

// 用於 UI 顯示商店的簡化介面
interface UiStore {
  name: string;
  merchantId: number;
  products: CartItem[];
  isAllSelected: boolean;
  isIndeterminate: boolean;
  notes: string;
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit {
  constructor(
    private router: Router,
    private httpClientService: HttpClientService,
    @Inject(DOCUMENT) private document: Document,
    public triggerAlertService: TriggerAlertService,
    private cdr: ChangeDetectorRef,
    private UsersServicesService: UsersServicesService
  ) { }

  // 【新】新增此屬性來控制確認彈窗的顯示狀態
  showConfirmationModal: boolean = false;

  // --- 表單綁定屬性 ---
  selectedPaymentMethod: string = 'CREDIT_CARD'; //
  userName: string = ''; //
  userEmail: string = ''; //

  // --- 購物車資料 ---
  cartItems: CartItem[] = []; // 這將是所有商品的總清單
  storesForDisplay: UiStore[] = []; // 【新】這個陣列將存放分組後用於 UI 顯示的資料

  // --- 表單驗證錯誤訊息 ---
  nameError: string = ''; //
  emailError: string = ''; //
  paymentError: string = ''; //

  ngOnInit(): void {
    this.loadCartData();
    // 如果服務中有使用者資料，預先填入
    this.userName = this.UsersServicesService.currentUserValue?.name || '';
    this.userEmail = this.UsersServicesService.currentUserValue?.email || '';
  }

  loadCartData(): void {
    const userEmail = this.UsersServicesService.currentUserValue?.email;
    if (!userEmail) {
      this.triggerAlertService.trigger('無法載入購物車，請先登入。', 'error');
      return;
    }

    // 使用後端 API 獲取指定 email 的購物車資料
    this.httpClientService.getApi<any>(`http://localhost:8080/carts/getDataByUserEmail/${userEmail}`).subscribe({
      next: (res) => {
        // 後端回應的資料結構包含 cartDataVo 和 merchants
        if (res && res.cartDataVo && res.cartDataVo.merchants) {
          const allItems: CartItem[] = [];
          res.cartDataVo.merchants.forEach((merchant: any) => {
            merchant.foodItems.forEach((food: any) => {
              allItems.push({
                id: food.foodId,
                storeName: merchant.merchantName,
                productName: food.foodName,
                price: food.price,
                quantity: food.quantity,
                image: food.imageUrl,
                selected: false,
                merchantId: merchant.merchantId
              });
            });
          });
          this.cartItems = allItems;
          this.groupDataForDisplay(); // 將資料分組到 storesForDisplay 中
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('取得購物車資料失敗', err);
        this.triggerAlertService.trigger('載入購物車失敗，請重新整理頁面。', 'error');
      }
    });
  }

  /**
   * 【新】將扁平的 cartItems 陣列，分組到 storesForDisplay 中，以便模板使用。
   */
  groupDataForDisplay(): void {
    const grouped: { [key: string]: { merchantId: number; items: CartItem[] } } = {};
    this.cartItems.forEach(item => {
      if (!grouped[item.storeName]) {
        grouped[item.storeName] = { merchantId: item.merchantId, items: [] };
      }
      grouped[item.storeName].items.push(item);
    });

    this.storesForDisplay = Object.keys(grouped).map(storeName => ({
      name: storeName,
      merchantId: grouped[storeName].merchantId,
      products: grouped[storeName].items,
      isAllSelected: false,
      isIndeterminate: false,
      notes: '' // 【新】初始化備註為空字串
    }));
    this.updateAllStoreSelectStates();// 更新所有店家的全選狀態
  }

  /**
 * 【新】取得在確認彈窗中被選中的店家列表
 */
  getStoresForConfirmation(): UiStore[] {
    const selectedItems = this.getSelectedItems();
    const selectedStoreNames = [...new Set(selectedItems.map(item => item.storeName))];

    return this.storesForDisplay.filter(store => selectedStoreNames.includes(store.name));
  }

  /**
   * 【修改】處理商品選取，並根據不同付款方式執行相應邏輯。
   */
  toggleItemSelection(itemToToggle: CartItem): void {
    // 如果使用信用卡付款且正在「選取」一個商品，則取消所有其他店家的商品選取。
    if (this.selectedPaymentMethod === 'CREDIT_CARD' && itemToToggle.selected) {
      this.cartItems = this.cartItems.map(item => {
        if (item.storeName !== itemToToggle.storeName) {
          return { ...item, selected: false };
        }
        return item;
      });
    }
    this.groupDataForDisplay(); // 重新分組以更新 UI
  }

  /**
   * 【新】切換特定店家所有商品的選取狀態。
   */
  toggleSelectAllForStore(store: UiStore): void {
    const areAllSelected = store.products.every(p => p.selected);

    // 如果使用信用卡且正要「全選」某店家，先取消其他店家的選取。
    if (this.selectedPaymentMethod === 'CREDIT_CARD' && !areAllSelected) {
      this.cartItems.forEach(item => {
        if (item.storeName !== store.name) {
          item.selected = false;
        }
      });
    }

    // 切換目標店家所有商品的選取狀態
    this.cartItems.forEach(item => {
      if (item.storeName === store.name) {
        item.selected = !areAllSelected;
      }
    });

    this.groupDataForDisplay();
  }

  /**
   * 【新】更新每個店家的 "isAllSelected" 和 "isIndeterminate" 狀態。
   */
  updateAllStoreSelectStates(): void {
    this.storesForDisplay.forEach(store => {
      if (store.products.length === 0) {
        store.isAllSelected = false;
        store.isIndeterminate = false;
        return;
      }
      const selectedCount = store.products.filter(p => p.selected).length;
      store.isAllSelected = selectedCount === store.products.length;
      store.isIndeterminate = selectedCount > 0 && selectedCount < store.products.length;
    });
  }

  /**
   * 【新】當付款方式變更時觸發的處理邏輯。
   */
  onPaymentMethodChange(): void {
    const selectedItems = this.getSelectedItems();
    const uniqueMerchantIds = new Set(selectedItems.map(item => item.merchantId));

    // 如果切換到信用卡模式，且已選了多家店的商品，則發出警告並取消多餘的選取。
    if (this.selectedPaymentMethod === 'CREDIT_CARD' && uniqueMerchantIds.size > 1) {
      this.triggerAlertService.trigger('信用卡一次只能結帳一家商店，已為您保留第一家商店的商品。', 'warning');
      const firstStoreName = selectedItems[0].storeName;
      this.cartItems.forEach(item => {
        if (item.storeName !== firstStoreName) {
          item.selected = false;
        }
      });
      this.groupDataForDisplay();
    }
  }

  getSelectedItems(): CartItem[] {
    return this.cartItems.filter(item => item.selected);
  }

  calculateSelectedTotal(): number {
    return this.getSelectedItems().reduce((total, item) => total + item.price * item.quantity, 0);
  }

  /**
   * 繼續購物 (導航回主頁或其他商品列表頁)
   */
  continueShopping(): void {
    this.router.navigate(['/main']);
  }

  /**
   * 【修改】此方法現在只負責驗證並打開確認彈窗
   */
  submitOrder(): void {
    // 執行表單驗證
    if (!this.validateForm()) {
      this.cdr.detectChanges();
      return;
    }

    // 如果驗證通過，打開確認彈窗，而不是直接下單
    this.showConfirmationModal = true;
  }

  validateForm(): boolean {
    this.nameError = '';
    this.emailError = '';
    let isValid = true;

    if (this.getSelectedItems().length === 0) {
      this.triggerAlertService.trigger('請至少選擇一項要結帳的商品。', 'warning');
      isValid = false;
    }
    if (!this.userName.trim()) {
      this.nameError = '請輸入訂購人姓名。';
      isValid = false;
    }
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    if (!this.userEmail.trim()) {
      this.emailError = '請輸入電子郵件。';
      isValid = false;
    } else if (!emailPattern.test(this.userEmail)) {
      this.emailError = '請輸入有效的電子郵件格式。';
      isValid = false;
    }
    return isValid;
  }

  /**
 * 【新】處理最終的訂單確認，執行真正的下單邏輯
 */
  handleFinalConfirmation(): void {
    const selectedItems = this.getSelectedItems();

    if (this.selectedPaymentMethod === 'CREDIT_CARD') {
      this.processSingleOrder(selectedItems);
    } else if (this.selectedPaymentMethod === 'CASH') {
      this.processMultipleOrders(selectedItems);
    }

    // 執行下單後關閉彈窗
    this.showConfirmationModal = false;
  }

  /**
   * 【新】取消訂單確認，僅關閉彈窗
   */
  cancelConfirmation(): void {
    this.showConfirmationModal = false;
  }

  /**
   * 建立並提交表單至藍新金流閘道
   * @param paymentInfo 後端 /api/payment/create 回傳的金流參數
   */
  submitToBluepay(paymentInfo: any): void {
    const form = this.document.createElement('form');
    form.method = 'POST';
    form.action = 'https://ccore.newebpay.com/MPG/mpg_gateway'; // 藍新金流正式環境網址
    form.target = '_self';

    const fields = {
      MerchantID: paymentInfo.merchantID,
      TradeInfo: paymentInfo.tradeInfo,
      TradeSha: paymentInfo.tradeSha,
      Version: paymentInfo.version,
    };

    for (const key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        const input = this.document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = (fields as any)[key];
        form.appendChild(input);
      }
    }
    this.document.body.appendChild(form);
    form.submit();
  }

  /**
   * 【新】處理單一訂單（信用卡）。
   */
 private processSingleOrder(selectedItems: CartItem[]): void {
    const totalAmount = this.calculateSelectedTotal();
    const itemDesc = selectedItems.map(item => `${item.productName} x${item.quantity}`).join(', ');
    const merchantId = selectedItems[0].merchantId;
    const storeInfo = this.storesForDisplay.find(s => s.merchantId === merchantId);
    const notesForThisStore = storeInfo ? storeInfo.notes : '';

    const orderCreationData = {
      userName: this.userName,
      userEmail: this.userEmail,
      merchantId: merchantId,
      merchant: selectedItems[0].storeName,
      totalAmount: totalAmount,
      status: 'pending',
      paymentMethodSimulated: 'CREDIT_CARD',
      notesToMerchant: notesForThisStore,
      orderItems: selectedItems.map(item => ({
        merchantsId: item.merchantId,
        foodId: item.id,
        foodName: item.productName,
        quantity: item.quantity,
        price: item.price
      })),
    };

    // 使用 .pipe() 將多個 API 呼叫串連起來
    this.httpClientService.postApi<OrderCreateResponse>('http://localhost:8080/orders/create', orderCreationData)
      .pipe(
        // 1. 建立訂單成功後，用 switchMap 串接下一個請求
        switchMap(orderResponse => {
          if (orderResponse.code !== 200 || !orderResponse.orderId) {
            // 如果訂單建立失敗，拋出錯誤，讓後面的 catchError 處理
            return throwError(() => new Error('建立訂單失敗: ' + orderResponse.message));
          }
          // 2. 訂單建立成功，現在向後端詢問公開網址
          return this.httpClientService.getApi<{ publicUrl: string }>('http://localhost:8080/api/payment/public-url')
            .pipe(
              map(config => ({ config, orderResponse })) // 將兩個請求的結果一起往下傳
            );
        }),
        // 3. 拿到公開網址後，用 switchMap 串接最後的付款請求
        switchMap(({ config, orderResponse }) => {
          const realOrderNumber = String(orderResponse.orderId);
          const paymentData = {
            amt: totalAmount,
            itemDesc: itemDesc,
            orderNumber: realOrderNumber
          };
          const paymentApiUrl = `${config.publicUrl}/api/payment/create`;

          return this.httpClientService.postApi<any>(paymentApiUrl, paymentData);
        })
      )
      .subscribe({
        next: (paymentInfo) => {
          // 4. 所有步驟都成功，最終拿到付款資訊，提交給藍新
          this.submitToBluepay(paymentInfo);
        },
        error: (err) => {
          // 鏈中任何一個環節出錯，都會在這裡被捕捉
          const errorMessage = err.message || '處理訂單時發生未知錯誤。';
          this.triggerAlertService.trigger(errorMessage, 'error');
        }
      });
  }

  /**
     * 【修正後】依店家分組處理多筆訂單（現金）。
     */
  private processMultipleOrders(selectedItems: CartItem[]): void {
    const ordersByMerchant: { [merchantId: number]: CartItem[] } = {};
    selectedItems.forEach(item => {
      if (!ordersByMerchant[item.merchantId]) {
        ordersByMerchant[item.merchantId] = [];
      }
      ordersByMerchant[item.merchantId].push(item);
    });

    const orderPromises = Object.values(ordersByMerchant).map(items => {
      const merchantId = items[0].merchantId;
      const storeName = items[0].storeName;
      const totalAmount = items.reduce((total, item) => total + item.price * item.quantity, 0);

      // 【重要】從 storesForDisplay 中找到對應的店家，以取得其備註
      const storeInfo = this.storesForDisplay.find(s => s.merchantId === merchantId);
      // 【關鍵修正】如果找不到，則使用空字串，不再讀取 this.notesToMerchant
      const notesForThisStore = storeInfo ? storeInfo.notes : '';

      const orderCreationData = {
        userName: this.userName,
        userEmail: this.userEmail,
        merchantId: merchantId,
        merchant: storeName,
        totalAmount: totalAmount,
        status: 'pending',
        paymentMethodSimulated: 'CASH',
        notesToMerchant: notesForThisStore, // 使用該店家的備註
        orderItems: items.map(item => ({ merchantsId: item.merchantId, foodId: item.id, foodName: item.productName, quantity: item.quantity, price: item.price })),
      };
      return this.httpClientService.postApi<OrderCreateResponse>('http://localhost:8080/orders/create', orderCreationData).toPromise();
    });

    Promise.all(orderPromises).then(results => {
      const allSuccess = results.every(res => res && res.code === 200);
      if (allSuccess) {
        this.triggerAlertService.trigger('所有現金訂單皆已成功建立！', 'success');
        this.router.navigate(['/paymentResult'], { queryParams: { status: 'success_cash' } });
      } else {
        this.triggerAlertService.trigger('部分訂單建立失敗，請確認您的訂單記錄。', 'warning');
      }
    }).catch(error => {
      console.error('建立現金訂單時發生錯誤', error);
      this.triggerAlertService.trigger('建立訂單時發生嚴重錯誤，請聯絡客服。', 'error');
    });
  }

  updateQuantity(id: number, quantityChangeOrEvent: number | Event): void {
    const userEmail = this.UsersServicesService.currentUserValue?.email;

    if (!userEmail) {
      this.triggerAlertService.trigger('無法取得使用者資訊，請重新登入後再試。', 'error');
      return;
    }

    const item = this.cartItems.find(item => item.id === id);
    if (!item) return;

    let newQuantity: number;
    let isFromInput = false; // 新增一個旗標來判斷來源

    if (typeof quantityChangeOrEvent === 'number') {
      // 來自加減按鈕的呼叫
      newQuantity = item.quantity + quantityChangeOrEvent;
    } else {
      // 來自輸入框的 change 事件
      isFromInput = true;
      const inputElement = quantityChangeOrEvent.target as HTMLInputElement;
      const parsedValue = inputElement.valueAsNumber;

      // 驗證輸入是否為有效數字，如果無效，則重設為原始數量並中止
      if (isNaN(parsedValue)) {
        inputElement.value = item.quantity.toString();
        this.triggerAlertService.trigger('請輸入有效的數字。', 'warning', 3000);
        return;
      }
      newQuantity = parsedValue;
    }

    // 如果計算出的新數量小於 1，則強制設為 1
    if (newQuantity < 1) {
      newQuantity = 1;
      // 如果是來自輸入框，且使用者輸入了小於1的數字，則把輸入框的值也更正為 1
      if (isFromInput) {
        const inputElement = (quantityChangeOrEvent as Event).target as HTMLInputElement;
        inputElement.value = '1';
      }
    }

    // 如果數量最終沒有變化，則無需發送 API 請求
    if (newQuantity === item.quantity) {
      return;
    }

    const body = {
      userEmail: userEmail,
      foodItemId: id,
      quantity: newQuantity
    };

    this.httpClientService.postApi<any>('http://localhost:8080/carts/update', body).subscribe({
      next: (res) => {
        if (res.code === 200) {
          // 更新成功，直接修改前端模型中的數據
          const foundItem = this.cartItems.find(i => i.id === id);
          if (foundItem) {
            foundItem.quantity = newQuantity;
          }
          this.groupDataForDisplay(); // 重新整理分組數據以更新UI
          this.triggerAlertService.trigger('商品數量更新成功', 'success');
        } else {
          // 後端返回錯誤訊息，恢復原始數量
          this.triggerAlertService.trigger(res.message, 'error');
          const foundItem = this.cartItems.find(i => i.id === id);
          if (foundItem) {
            foundItem.quantity = item.quantity;
          }
          this.groupDataForDisplay();
        }
      },
      error: (err) => {
        const backendMessage = err.error?.message || '更新失敗，請稍後再試';
        this.triggerAlertService.trigger(backendMessage, 'error', 4000);
        // API 請求失敗，恢復原始數量
        const foundItem = this.cartItems.find(i => i.id === id);
        if (foundItem) {
          foundItem.quantity = item.quantity;
        }
        this.groupDataForDisplay();
      }
    });
  }
  removeItem(id: number): void {
    const userEmail = this.UsersServicesService.currentUserValue?.email;
    if (!userEmail) { /* ...錯誤處理... */ return; }

    const body = { userEmail: userEmail, foodItemId: id };

    // 呼叫後端 API 刪除項目
    this.httpClientService.postApi<any>('http://localhost:8080/carts/delete', body).subscribe({
      next: (res) => {
        if (res.code === 200) {
          this.triggerAlertService.trigger('商品已從購物車移除', 'success');
          this.cartItems = this.cartItems.filter(item => item.id !== id);
          this.groupDataForDisplay(); // 刷新顯示
        } else {
          this.triggerAlertService.trigger(res.message, 'error');
        }
      },
      error: (err) => { /* ...錯誤處理... */ }
    });
  }
}
