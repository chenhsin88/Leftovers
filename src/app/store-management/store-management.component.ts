import { Component, OnInit } from '@angular/core'; // 引入 OnInit
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientService } from '../@http-services/http.service';
import { ActivatedRoute } from '@angular/router';
import { TriggerAlertService } from '../@Services/trigger-alert.service';

// 營業時間介面定義
interface BusinessHours {
  [key: string]: {
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  };
}

// 商家資料介面定義
interface BusinessData {
  merchantsId: number;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  googleMapUrl: string;
  pickupMethod: string;
  pickupInstructions: string;
}

// 圖片資料介面定義
interface Images {
  logo: string;
  banner: string;
  map: string;
}

// 從 API 取得的商家資料介面定義
interface Merchant {
  merchantsId: number;
  name: string;
  description: string;
  addressText: string;
  phoneNumber: string;
  contactEmail: string;
  opening_hoursDescription: string;
  approvedByAdminId: number;
  approvedAt: any;
  logoUrl: string;
  bannerImageUrl: string;
  mapGoogleUrl: string;
  mapScreenshotUrl: string;
  active: boolean;
  pickupInstructions: string;
}

@Component({
  selector: 'app-store-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './store-management.component.html',
  styleUrls: ['./store-management.component.scss']
})
export class StoreManagementComponent implements OnInit { // 實作 OnInit
  storeId!: number;

  // 用於營業時間下拉選單的選項
  timeOptions: string[] = [];

  phoneType: 'mobile' | 'landline' = 'mobile';
  phone_mobile: string = '';
  phone_landline_area: string = '';
  phone_landline_part1: string = '';
  phone_landline_part2: string = '';
  public isSaving = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private httpClientService: HttpClientService,
    public triggerAlertService: TriggerAlertService,
  ) { }

  storeDetails: Merchant | null = null;


  ngOnInit(): void {
    // 1. 初始化時間選項
    this.generateTimeOptions();

    // 2. 從父路由取得 storeId 並獲取商家資料
    this.route.parent?.paramMap.subscribe(params => {
      const merchantId = Number(params.get('storeId'));
      console.log('取得的 storeId:', merchantId); // 除錯用

      if (merchantId) {
        this.httpClientService.getApi<any>(`http://localhost:8080/merchants/getMerchantsData/${merchantId}`)
          .subscribe({
            next: res => {
              console.log('API 回傳資料:', res); // 除錯用

              if (res.code === 200 || res.code === '200') {
                const merchant = res.merchants?.[0];
                if (merchant) {
                  this.storeDetails = merchant;
                  this.loadStoreDataFromApiRes(merchant);
                } else {
                  console.warn('查無商家資料');
                }
              } else {
                console.warn('查無資料:', res.message);
              }
            },
            error: err => {
              console.error('API 錯誤:', err);
            }
          });
      } else {
        console.warn('storeId 無效或缺少');
      }
    });
  }

  // 產生每30分鐘一個間隔的時間選項
  generateTimeOptions(): void {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hour = h.toString().padStart(2, '0');
        const minute = m.toString().padStart(2, '0');
        options.push(`${hour}:${minute}`);
      }
    }
    this.timeOptions = options;
  }

  loadStoreDataFromApiRes(merchant: Merchant): void {
    this.businessData = {
      merchantsId: merchant.merchantsId,
      name: merchant.name,
      description: merchant.description,
      address: merchant.addressText,
      phone: merchant.phoneNumber,
      email: merchant.contactEmail,
      googleMapUrl: merchant.mapGoogleUrl,
      pickupMethod: '自取', // 可根據需求調整或從 API 獲取
      pickupInstructions: merchant.pickupInstructions
    };

    this.images = {
      logo: this.transformImageUrl(merchant.logoUrl),
      banner: this.transformImageUrl(merchant.bannerImageUrl),
      map: this.transformImageUrl(merchant.mapScreenshotUrl)
    };

    if (merchant.opening_hoursDescription) {
      this.businessHours = this.parseOpeningHours(merchant.opening_hoursDescription);
    }

    // ✅ 新增：呼叫電話解析方法
    this.setupPhoneInputs(merchant.phoneNumber);
  }

  /**
   * 解析從 API 來的電話號碼字串，並設定對應的表單欄位
   * @param phoneNumber API 回傳的電話號碼
   */
  setupPhoneInputs(phoneNumber: string): void {
    if (!phoneNumber) return;

    // 檢查是否包含 '-' 來判斷是市話還是手機
    if (phoneNumber.includes('-')) {
      this.phoneType = 'landline';
      const parts = phoneNumber.split('-');
      this.phone_landline_area = parts[0] || '';
      this.phone_landline_part1 = parts[1] || '';
      this.phone_landline_part2 = parts[2] || '';
    } else {
      this.phoneType = 'mobile';
      this.phone_mobile = phoneNumber;
    }
  }

  transformImageUrl(urlPart: string): string {
    if (!urlPart) return '';
    if (urlPart.startsWith('data:image')) {
      return urlPart;
    }
    return `data:image/png;base64,${urlPart}`;
  }

  parseOpeningHours(description: string): BusinessHours {
    const dayMap = {
      '星期一': 'monday', '星期二': 'tuesday', '星期三': 'wednesday',
      '星期四': 'thursday', '星期五': 'friday', '星期六': 'saturday', '星期日': 'sunday'
    } as const;

    const businessHours: BusinessHours = {
      monday: { isOpen: false, openTime: '', closeTime: '' },
      tuesday: { isOpen: false, openTime: '', closeTime: '' },
      wednesday: { isOpen: false, openTime: '', closeTime: '' },
      thursday: { isOpen: false, openTime: '', closeTime: '' },
      friday: { isOpen: false, openTime: '', closeTime: '' },
      saturday: { isOpen: false, openTime: '', closeTime: '' },
      sunday: { isOpen: false, openTime: '', closeTime: '' },
    };

    if (!description) { return businessHours; }

    const parts = description.split('，');
    parts.forEach(part => {
      const [dayStr, timeStr] = part.trim().split(' ');
      if (dayStr in dayMap) {
        const dayKey = dayMap[dayStr as keyof typeof dayMap];
        if (timeStr === '未營業' || !timeStr) {
          businessHours[dayKey] = { isOpen: false, openTime: '', closeTime: '' };
        } else {
          const [open, close] = timeStr.split('-');
          businessHours[dayKey] = { isOpen: true, openTime: open || '', closeTime: close || '' };
        }
      }
    });
    return businessHours;
  }

  viewMode: 'edit' | 'preview' = 'preview';

  businessData: BusinessData = {
    merchantsId: 0,
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    googleMapUrl: '',
    pickupMethod: '自取',
    pickupInstructions: ''
  };

  businessHours: BusinessHours = {
    monday: { isOpen: false, openTime: '', closeTime: '' },
    tuesday: { isOpen: false, openTime: '', closeTime: '' },
    wednesday: { isOpen: false, openTime: '', closeTime: '' },
    thursday: { isOpen: false, openTime: '', closeTime: '' },
    friday: { isOpen: false, openTime: '', closeTime: '' },
    saturday: { isOpen: false, openTime: '', closeTime: '' },
    sunday: { isOpen: false, openTime: '', closeTime: '' }
  };

  images: Images = {
    logo: '',
    banner: '',
    map: ''
  };

  dayNames = {
    monday: '星期一', tuesday: '星期二', wednesday: '星期三',
    thursday: '星期四', friday: '星期五', saturday: '星期六', sunday: '星期日'
  };

  get dayEntries() {
    return Object.entries(this.dayNames);
  }

  updateBusinessData<K extends keyof BusinessData>(field: K, value: BusinessData[K]): void {
    this.businessData[field] = value;
  }

  // 更新營業時間並加入驗證
  // 注意：此方法需要對應的 HTML 使用 <select> 並觸發 (change) 事件
  updateBusinessHours(day: string, field: 'openTime' | 'closeTime', value: string): void {
    const dayHours = this.businessHours[day];
    dayHours[field] = value;

    // 如果是更新開始時間，檢查結束時間是否依然有效，無效則清空
    if (field === 'openTime' && dayHours.closeTime && value >= dayHours.closeTime) {
      dayHours.closeTime = '';
    }
  }

  /**
   * 判斷結束時間的選項是否應被禁用
   * 注意：此方法需要對應的 HTML 在 <option> 上使用 [disabled] 綁定
   * @param optionTime - 目前迴圈中的時間選項, e.g., "09:30"
   * @param startTime - 該日已選擇的開始時間, e.g., "09:00"
   * @returns boolean - 如果選項時間早於等於開始時間，則回傳 true (禁用)
   */
  isEndTimeOptionDisabled(optionTime: string, startTime: string): boolean {
    if (!startTime) {
      return false;
    }
    return optionTime <= startTime;
  }

  toggleBusinessDay(day: string): void {
    this.businessHours[day].isOpen = !this.businessHours[day].isOpen;
  }

  handleImageUpload(type: keyof Images): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = (event: any) => {
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e: any) => { this.images[type] = e.target.result; };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  formatOpeningHours(): string {
    const parts: string[] = [];
    for (const [dayKey, dayLabel] of Object.entries(this.dayNames)) {
      const hours = this.businessHours[dayKey];
      if (hours.isOpen && hours.openTime && hours.closeTime) {
        parts.push(`${dayLabel} ${hours.openTime}-${hours.closeTime}`);
      } else {
        parts.push(`${dayLabel} 未營業`);
      }
    }
    return parts.join('，');
  }

  handleSave(): void {
    if (!this.businessData.merchantsId) {
      console.error("商家 ID 無效，無法儲存");
      this.triggerAlertService.trigger('資料不完整，無法儲存', 'error');
      return;
    }

    let finalPhoneNumber = '';

    if (this.phoneType === 'mobile') {
      finalPhoneNumber = this.phone_mobile;
    } else {
      finalPhoneNumber = `${this.phone_landline_area}-${this.phone_landline_part1}-${this.phone_landline_part2}`;
    }

    const phoneRegex = /^(0\d{1,2}-\d{3,4}-\d{4}|09\d{2}-?\d{3}-?\d{3})$/;

    if (!finalPhoneNumber || !phoneRegex.test(finalPhoneNumber)) {
      // 如果電話號碼為空或格式不符，則顯示後端定義的錯誤訊息
      this.triggerAlertService.trigger('電話格式錯誤', 'error');
      return; // 中斷儲存操作
    }

    const openingHoursDescription = this.formatOpeningHours();
    const updateReq = {
      merchantsId: this.businessData.merchantsId,
      name: this.businessData.name,
      description: this.businessData.description,
      addressText: this.businessData.address,
      phoneNumber: finalPhoneNumber, // ✅ 使用我們組合好的新號碼
      contactEmail: this.businessData.email,
      logoUrl: this.images.logo,
      bannerImageUrl: this.images.banner,
      openingHoursDescription: openingHoursDescription,
      mapScreenshotUrl: this.images.map,
      mapGoogleUrl: this.businessData.googleMapUrl,
      pickupInstructions: this.businessData.pickupInstructions,
    };

    console.log("準備儲存的資料:", updateReq);

    this.httpClientService.postApi('http://localhost:8080/merchants/update', updateReq)
      .subscribe({
        next: () => {
          this.triggerAlertService.trigger('儲存成功', 'success');
          this.viewMode = 'preview';
        },
        error: (err) => {
          console.error('更新失敗:', err);
          this.triggerAlertService.trigger('儲存失敗，請稍後再試', 'error');
        }
      });
  }

  backToEdit(): void {
    this.viewMode = 'edit';
  }
}
