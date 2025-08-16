import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms"
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClientService } from '../@http-services/http.service';
import { CommonModule } from '@angular/common';
import { TriggerAlertService } from '../@Services/trigger-alert.service';
import { ConfirmationService } from '../@Services/confirmation.service';

export interface FoodItem {
  id?: number; //商品id
  name: string
  imageUrl: string
  description: string
  quantityAvailable: number
  category: string
  originalPrice: number
  discountedPrice: number
  pickupStartTime: string
  pickupEndTime: string
  active: boolean
}


@Component({
  selector: 'app-product-inventory',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './product-inventory.component.html',
  styleUrl: './product-inventory.component.scss'
})
export class ProductInventoryComponent {
  items: FoodItem[] = [];
  image: string = "";
  storeId: string | null = null;
  isChecked = false; // 預設 light theme

  toggleTheme() {
    // 這裡其實不需要寫反轉，因為 ngModel 已雙向綁定
    // this.isChecked = !this.isChecked;
  }

  ngOnInit(): void {

    this.route.parent?.paramMap.subscribe(params => {
      this.storeId = params.get('storeId');
      console.log('子路由收到父路由 storeId:', this.storeId);
    });

    const merchantsId = this.storeId;  // ⛔目前寫死，測試用的，實際應由登入商家ID取得，記得未來替換
    console.log('Sending merchantsId:', merchantsId);

    this.httpClientService.postApi('http://localhost:8080/fooditems/getAllByMerchantId', { merchantsId })
      .subscribe({
        next: (res: any) => {
          console.log(res);
          // 改用 res.vos 而不是 res.foodItems
          if (res && res.vos) {
            this.items = res.vos.map((item: any) => {
              return {
                id: item.id,
                name: item.name,
                imageUrl: item.imageUrl,
                description: item.description,
                quantityAvailable: item.quantityAvailable,
                category: item.category,
                originalPrice: item.originalPrice,
                discountedPrice: item.discountedPrice,
                pickupStartTime: item.pickupStartTime?.substring(11, 16) || "00:00", // 擷取 HH:mm
                pickupEndTime: item.pickupEndTime?.substring(11, 16) || "00:00",
                active: item.active
              } as FoodItem;
            });
          } else {
            console.error("API 回傳資料結構異常，找不到 'vos' 欄位");
          }
        },
        error: (err) => {
          console.error("商品載入失敗：", err);
        }
      });
  }


  categories = ["烘焙", "麻辣", "飲品", "甜點", "熟食", "生食", "盲盒", "素食", "其他"]

  isModalOpen = false
  editingItem: FoodItem | null = null
  itemForm: FormGroup

  timeSlots: string[] = []

  // 自動產生時間選項
  generateTimeSlots(start: string, end: string, intervalMinutes: number): string[] {
    const slots: string[] = []
    let [h, m] = start.split(":").map(Number)
    const [endH, endM] = end.split(":").map(Number)

    while (h < endH || (h === endH && m <= endM)) {
      const formatted = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      slots.push(formatted)

      m += intervalMinutes
      if (m >= 60) {
        h += Math.floor(m / 60)
        m = m % 60
      }
    }

    return slots
  }

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private httpClientService: HttpClientService,
    private route: ActivatedRoute,
    public triggerAlertService: TriggerAlertService,
    public confirmationService: ConfirmationService
  ) {
    this.timeSlots = this.generateTimeSlots("00:00", "23:30", 30) // 每 30 分鐘一格
    this.itemForm = this.fb.group({
      name: ["", Validators.required],
      imageUrl: ["", Validators.required],
      description: ["", Validators.required],  // 設為必填欄位
      quantityAvailable: [1, Validators.required],
      category: ["烘焙類"],
      originalPrice: [null, Validators.required],
      discountedPrice: [null, Validators.required],
      pickupStartTime: ["09:00"],
      pickupEndTime: ["21:00"],
    }, { validators: this.discountValidator }); // 加上自訂的折扣價驗證
  }

  // 自訂驗證器：檢查折扣價是否大於原價
  discountValidator(group: FormGroup): { [key: string]: boolean } | null {
    const originalPrice = group.get('originalPrice')?.value;
    const discountedPrice = group.get('discountedPrice')?.value;

    // 檢查折扣價是否大於原價
    if (originalPrice && discountedPrice && discountedPrice > originalPrice) {
      return { 'discountAboveOriginal': true }; // 返回錯誤訊息
    }
    return null; // 沒有錯誤
  }

  get activeItems() {
    return this.items.filter(item => item.active); // ✅ 不用再比對字串
  }

  get inactiveItems() {
    return this.items.filter(item => !item.active)
  }

  openModal(item?: FoodItem) {
    this.isModalOpen = true;

    if (item) {
      this.editingItem = item;
      this.itemForm.patchValue(item);
      this.image = item.imageUrl || "";  // 回填圖片
    } else {
      this.editingItem = null;
      this.resetForm();
      this.image = ""; // 清空圖片
    }
  }

  closeModal() {
    this.isModalOpen = false
    this.editingItem = null
    this.resetForm()
  }

  resetForm() {
    this.itemForm.reset({
      name: "",
      imageUrl: "",
      description: "",
      quantityAvailable: 1,
      category: "烘焙類",
      originalPrice: null,
      discountedPrice: null,
      pickupStartTime: "09:00",
      pickupEndTime: "21:00",
    })
  }

  handleImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = (e: any) => {
        this.image = e.target.result;
        this.itemForm.patchValue({ imageUrl: this.image });
      };

      reader.readAsDataURL(file);
    }
  }

  triggerImageUpload(): void {
    const inputElement = document.getElementById('foodImageUpload') as HTMLInputElement;
    inputElement?.click();
  }

  //取貨起訖時間轉字串，前端只有HH:mm，後端是LocalDateTime格式(如：2025-06-07T15:00:00)
  convertTimeToISO(time: string): string {
    const today = new Date();
    const [hours, minutes] = time.split(":").map(Number);
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const h = hours.toString().padStart(2, '0');
    const m = minutes.toString().padStart(2, '0');

    return `${year}-${month}-${day}T${h}:${m}:00`; // e.g., "2025-06-18T18:00:00"
  }


  onSubmit() {
    // 檢查表單是否有效
    if (this.itemForm.invalid) {
      // 遍歷所有表單控制項，找出第一個無效的控制項
      const firstInvalidControl = Object.keys(this.itemForm.controls).find(control => this.itemForm.controls[control].invalid);

      if (firstInvalidControl) {
        // 檢查並顯示錯誤訊息
        const errorMessage = this.getErrorMessage(firstInvalidControl);
        this.triggerAlertService.trigger(errorMessage, 'warning');
      }
      return;
    }

    const formValue = this.itemForm.value;

    // 檢查折扣價是否大於原價
    if (formValue.discountedPrice > formValue.originalPrice) {
      this.triggerAlertService.trigger('折扣後價格不能大於原價', 'warning');
      return;
    }

    // 檢查圖片是否存在 (如果沒有圖片URL)
    if (!this.image && !formValue.imageUrl) {
      this.triggerAlertService.trigger('商品圖片為必填', 'warning');
      return;
    }

    const pickupStart = this.convertTimeToISO(formValue.pickupStartTime);
    const pickupEnd = this.convertTimeToISO(formValue.pickupEndTime);

    // 檢查時間是否正確
    if (new Date(pickupStart) > new Date(pickupEnd)) {
      this.triggerAlertService.trigger('取貨開始時間不能晚於結束時間', 'warning');
      return;
    }

    // 準備提交的商品資料
    const itemPayload: any = {
      name: formValue.name,
      description: formValue.description,
      imageUrl: this.image || formValue.imageUrl, // 確保有圖片 URL
      originalPrice: formValue.originalPrice,
      discountedPrice: formValue.discountedPrice,
      quantityAvailable: formValue.quantityAvailable,
      pickupStartTime: pickupStart,
      pickupEndTime: pickupEnd,
      pickupInstructions: "請準時取餐", // 固定的取餐說明
      category: formValue.category,
      active: true, // 預設為啟用
      merchantsId: this.storeId, // 商家 ID
      id: this.editingItem?.id, // 若是編輯則帶入已有商品 ID
    };
    // 編輯商品
    if (this.editingItem) {
      itemPayload.active = this.editingItem.active;

      this.httpClientService.postApi('http://localhost:8080/fooditems/update', itemPayload).subscribe({
        next: (res) => {
          this.triggerAlertService.trigger('商品已成功更新', 'success');

          const index = this.items.findIndex(item => item.id === this.editingItem!.id);

          if (index !== -1) {
            // 依據數量修正 active 狀態
            const updatedActive = formValue.quantityAvailable > 0;

            // 更新商品資料
            this.items[index] = {
              ...this.items[index],
              ...formValue,
              active: updatedActive,
              imageUrl: this.image || formValue.imageUrl, // 確保有圖片 URL
              pickupStartTime: formValue.pickupStartTime,
              pickupEndTime: formValue.pickupEndTime,
            };
          }

          this.closeModal();
        },
        error: (err) => {
          console.error("商品更新失敗：", err);
          this.triggerAlertService.trigger('商品更新失敗，請稍後再試', 'error');
        }
      });

    } else {
      // 新增商品
      const newItem: FoodItem = {
        name: formValue.name,
        imageUrl: this.image || formValue.imageUrl, // 確保有圖片 URL
        description: formValue.description,
        quantityAvailable: formValue.quantityAvailable,
        category: formValue.category,
        originalPrice: formValue.originalPrice,
        discountedPrice: formValue.discountedPrice,
        pickupStartTime: formValue.pickupStartTime,
        pickupEndTime: formValue.pickupEndTime,
        active: formValue.quantityAvailable > 0, // 根據庫存量設置 active 狀態
      };

      this.httpClientService.postApi('http://localhost:8080/fooditems/create', itemPayload)
        .subscribe({
          next: (res) => {
            this.triggerAlertService.trigger('商品已成功新增', 'success');
            this.items.push(newItem);
            this.closeModal();
          },
          error: (err) => {
            console.error("商品新增失敗：", err);
            this.triggerAlertService.trigger('商品新增失敗，請稍後再試', 'error');
          }
        });
    }
  }


  // 根據控制項名稱獲取錯誤訊息
  getErrorMessage(controlName: string): string {
    const control = this.itemForm.controls[controlName];

    // 檢查 errors 是否為 null
    if (control.errors) {
      if (control.hasError('required')) {
        return '' + this.getFieldLabel(controlName) + ' 為必填欄位';
      }
      if (control.hasError('min')) {
        return '' + this.getFieldLabel(controlName) + ' 不能小於 ' + control.errors['min'].min;
      }
      if (control.hasError('pattern')) {
        return '' + this.getFieldLabel(controlName) + ' 格式不正確';
      }
      if (control.hasError('maxlength')) {
        return '' + this.getFieldLabel(controlName) + ' 長度不能超過 ' + control.errors['maxlength'].requiredLength;
      }
    }

    // 若找不到錯誤或沒有錯誤訊息，回傳一個通用訊息
    return '' + this.getFieldLabel(controlName) + ' 填寫錯誤';
  }


  // 根據欄位名稱取得對應的顯示標籤
  getFieldLabel(controlName: string): string {
    const labels: { [key: string]: string } = {
      'name': '商品名稱',
      'description': '食物內容描述',
      'imageUrl': '商品圖片',
      'originalPrice': '原價',
      'discountedPrice': '折扣價',
      'quantityAvailable': '庫存數量',
      'pickupStartTime': '取貨開始時間',
      'pickupEndTime': '取貨結束時間',
      'category': '商品類別'
      // 你可以根據需要，繼續補充其他控制項的標籤
    };

    return labels[controlName] || controlName; // 若找不到對應的標籤，則回傳控制項名稱
  }


  removeItem(index: number): void {
    const message = "確定要下架此商品嗎？商品將標示為已下架。";

    // 開啟確認對話框，並訂閱其結果
    this.confirmationService.open(message).subscribe(confirmed => {
      // `confirmed` 會是 true 或 false
      if (confirmed) {
        // 如果使用者點擊了「確定」，才執行下架的邏輯
        const foodItem = this.items[index];

        const removeItem = {
          id: foodItem.id,
          merchantsId: this.storeId
        };

        this.httpClientService.postApi('http://localhost:8080/fooditems/deactivateById', removeItem)
          .subscribe({
            next: (res: any) => {
              if (res.code === 200) {
                this.triggerAlertService.trigger('商品已成功下架', 'success');
                this.items[index].active = false;
              } else {
                this.triggerAlertService.trigger('下架失敗：' + res.message, 'error');
              }
            },
            error: (err) => {
              console.error("API 錯誤：", err);
              this.triggerAlertService.trigger('下架失敗，請稍後再試', 'error');
            }
          });
      }
      // 如果 confirmed 是 false (使用者點擊「取消」)，則這個 if 區塊不會被執行，什麼事都不會發生
    });
  }


  // 刪除商品 (真正刪除)
  deleteFoodItem(item: FoodItem, index: number) {
    if (!item.id) {
      this.triggerAlertService.trigger('商品資料不完整，無法刪除', 'error');
      console.log(item.id);
      console.log(item);
      return;
    }

    // 1. 定義要顯示的訊息
    const message = "確定要永久刪除此商品嗎？此操作無法還原。";

    // 2. 呼叫確認服務，並訂閱結果
    this.confirmationService.open(message).subscribe(confirmed => {

      // 3. 如果使用者點擊「確定」(confirmed 為 true)，才執行刪除邏輯
      if (confirmed) {

        // --- 將原本 if(confirm(...)) 內的邏輯，整個搬到這裡 ---
        const deleteItem = {
          id: item.id,
          merchantsId: this.storeId
        };

        this.httpClientService.postApi('http://localhost:8080/fooditems/deleteById', deleteItem)
          .subscribe({
            next: () => {
              this.triggerAlertService.trigger('商品已成功刪除', 'success');
              this.items.splice(index, 1);
            },
            error: (err) => {
              console.error("刪除失敗：", err);
              this.triggerAlertService.trigger('刪除失敗，請稍後再試。', 'error');
            }
          });
      }
    });
  }

  calculateDiscount(originalPrice: number, discountedPrice: number) {
    if (originalPrice <= 0) return 0
    return Math.round((1 - discountedPrice / originalPrice) * 100)
  }

  getImageUrl(url: string, name: string) {
    return url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
  }

  // 如果你需要使用 router 的話，可以加入這些方法
  navigateToOtherPage() {
    this.router.navigate(["/other-page"])
  }

  goBack() {
    this.router.navigate(["/"])
  }
}
