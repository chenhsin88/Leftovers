import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientService } from '../@http-services/http.service';
import { TriggerAlertService } from '../@Services/trigger-alert.service';
import { gsap } from "gsap";
import { UsersServicesService, Merchant } from './../@Services/users-services.service'; // 假設 Merchant 型別也從此匯出
import { SafeUrlPipe } from '../safe-url.pipe';
import { finalize } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';


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
  merchantsId?: number;
  name: string;
  description: string;
  address: string;
  googleMapUrl: string;
  phone: string;
  email: string;
  pickupMethod: string;
  pickupInstructions: string;
}

// 圖片資料介面定義
interface Images {
  logo: string;
  banner: string;
  map: string;
}
@Component({
  selector: 'app-merchant-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeUrlPipe, MatIconModule, RouterLink,  MatButtonModule],
  templateUrl: './merchant-registration.component.html',
  styleUrl: './merchant-registration.component.scss'
})
export class MerchantRegistrationComponent implements OnInit {

  IconShowOrNot: boolean = false;
  LightDarkContolIsChoose: boolean = false;
  profilePictureUrl: string = '';
  public isSaving = false;

  // 用來追蹤使用者選擇的是手機還是市話，預設為 'mobile'
  phoneType: 'mobile' | 'landline' = 'mobile';

  // 分別綁定手機和市話的輸入框
  phone_mobile: string = '';
  // 將原本一個市話變數，拆成三個部分
  phone_landline_area: string = ''; // 區碼
  phone_landline_part1: string = ''; // 前段號碼
  phone_landline_part2: string = ''; // 後段號碼

  // 【整合點】新增一個屬性，用來「備份」從後端拿到的最原始、乾淨的商家資料
  private originalMerchantData: any = null;

  timeOptions: string[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private httpClientService: HttpClientService,
    public triggerAlertService: TriggerAlertService,
    private UsersServicesService: UsersServicesService
  ) { }

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
    document.body.style.overflow = 'auto';
    this.generateTimeOptions();
    this.profilePictureUrl = this.UsersServicesService.currentUserValue?.profilePictureUrl || ''; // 使用 || '' 避免 null 或 undefined
  }

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

  // 其他不變的方法 (gsap, formatOpeningHours 等)...
  businessData: BusinessData = {
    name: '',
    description: '',
    address: '',
    googleMapUrl: '',
    phone: '',
    email: '',
    pickupMethod: '自取',
    pickupInstructions: ''
  };

  isChecked: boolean = false;

  ngAfterViewInit(): void {
    // 當 View 準備好後，根據初始狀態設定圖示的樣式
    // 使用 gsap.set() 可以立即設定樣式，沒有動畫效果
    if (this.LightDarkContolIsChoose) {
      // 初始是暗模式
      gsap.set("#Sun", { opacity: 0, scale: 0 });
      gsap.set("#Moon", { opacity: 1, scale: 1 });
    } else {
      // 初始是亮模式
      gsap.set("#Sun", { opacity: 1, scale: 1 });
      gsap.set("#Moon", { opacity: 0, scale: 0 });
    }
  }

  // 切換主題的邏輯 (你的原版動畫邏輯是正確的，現在它將可以正常工作)
  LightDarkContolison(): void {
    // 關鍵修復：在執行任何動畫判斷之前，先將狀態反轉
    this.LightDarkContolIsChoose = !this.LightDarkContolIsChoose;

    // 現在，底下的判斷邏輯就能根據最新的狀態正確運作了
    if (this.LightDarkContolIsChoose) {
      // 切到暗模式，太陽隱藏，月亮出現
      gsap.to("#Sun", {
        duration: 0.4,
        opacity: 0,
        scale: 0.7,
        rotation: -90,
        ease: "power1.in",
        force3D: true,
        overwrite: "auto"
      });

      gsap.fromTo(
        "#Moon",
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
      // 切到淺色模式，月亮隱藏，太陽出現
      gsap.to("#Moon", {
        duration: 0.4,
        opacity: 0,
        scale: 0.7,
        rotation: 90,
        ease: "power1.in",
        force3D: true,
        overwrite: "auto"
      });

      gsap.fromTo(
        "#Sun",
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


  viewMode: 'edit' | 'preview' = 'edit';

  businessHours: BusinessHours = {
    monday: { isOpen: true, openTime: '', closeTime: '' },
    tuesday: { isOpen: true, openTime: '', closeTime: '' },
    wednesday: { isOpen: true, openTime: '', closeTime: '' },
    thursday: { isOpen: true, openTime: '', closeTime: '' },
    friday: { isOpen: true, openTime: '', closeTime: '' },
    saturday: { isOpen: true, openTime: '', closeTime: '' },
    sunday: { isOpen: true, openTime: '', closeTime: '' }
  };

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

  images: Images = {
    logo: '',
    banner: '',
    map: ''
  };

  dayNames = {
    monday: '星期一',
    tuesday: '星期二',
    wednesday: '星期三',
    thursday: '星期四',
    friday: '星期五',
    saturday: '星期六',
    sunday: '星期日'
  };

  get dayEntries() {
    return Object.entries(this.dayNames);
  }

  // 使用 Exclude<..., 'merchantsId'> 來告訴 TypeScript，field 參數不會是 'merchantsId'
  updateBusinessData(field: Exclude<keyof BusinessData, 'merchantsId'>, value: string): void {
    this.businessData[field] = value;
  }

  // 簡化後的更新邏輯
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
   * @param optionTime - 目前迴圈中的時間選項, e.g., "09:30"
   * @param startTime - 該日已選擇的開始時間, e.g., "09:00"
   * @returns boolean - 如果選項時間早於等於開始時間，則回傳 true (禁用)
   */
  isEndTimeOptionDisabled(optionTime: string, startTime: string): boolean {
    // 如果還沒選擇開始時間，則不禁用任何選項
    if (!startTime) {
      return false;
    }
    // 字串比較 '09:30' > '09:00' 會正確運作
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

  handleSave(): void {
    // 在送出前，根據 phoneType 組合出最終的電話號碼字串
    let finalPhoneNumber = '';
    if (this.phoneType === 'mobile') {
      finalPhoneNumber = this.phone_mobile;
    } else {
      // 將三個部分用 '-' 串接起來
      finalPhoneNumber = `${this.phone_landline_area}-${this.phone_landline_part1}-${this.phone_landline_part2}`;
    }
    this.businessData.phone = finalPhoneNumber;
    // 必填欄位檢查
    const missingFields: string[] = [];

    if (!this.businessData.name.trim()) missingFields.push('商家名稱');
    if (!this.businessData.description.trim()) missingFields.push('商家簡介');
    if (!this.businessData.address.trim()) missingFields.push('地址');
    // 驗證邏輯也需要更新
    if (this.phoneType === 'mobile' && !this.phone_mobile.trim()) {
      missingFields.push('手機號碼');
    } else if (this.phoneType === 'landline' && (!this.phone_landline_area.trim() || !this.phone_landline_part1.trim() || !this.phone_landline_part2.trim())) {
      missingFields.push('完整的市話號碼');
    }
    if (!this.businessData.email.trim()) missingFields.push('聯絡信箱');
    if (!this.businessData.pickupInstructions.trim()) missingFields.push('取餐說明');
    if (!this.images.logo) missingFields.push('商家 LOGO');
    if (!this.images.banner) missingFields.push('商家橫幅');
    if (!this.images.map) missingFields.push('地圖截圖');

    // 檢查營業時間是否有任一天是開啟但沒填時間
    for (const [dayKey, hours] of Object.entries(this.businessHours)) {
      if (hours.isOpen) {
        if (!hours.openTime || !hours.closeTime) {
          // 類型斷言解決索引錯誤
          missingFields.push(`${this.dayNames[dayKey as keyof typeof this.dayNames]} 營業時間`);
        }
      }
    }

    if (missingFields.length > 0) {
      const alertMsg = '以下欄位為必填，請補齊後再提交：\n\n' + missingFields.join('、');
      this.triggerAlertService.trigger(alertMsg, 'warning', 5000);
      return; // ❌ 不送出資料
    }

    const phoneRegex = /^(0\d{1,2}-\d{3,4}-\d{4}|09\d{2}-?\d{3}-?\d{3})$/;

    if (!finalPhoneNumber || !phoneRegex.test(finalPhoneNumber)) {
      // 如果電話號碼為空或格式不符，則顯示後端定義的錯誤訊息
      this.triggerAlertService.trigger('電話格式錯誤', 'error');
      return; // 中斷儲存操作
    }

    if (this.isSaving) {
      return;
    }
    this.isSaving = true;

    // 通過檢查後繼續送出
    const openingHoursDescription = this.formatOpeningHours();

    const currentUserEmail = this.UsersServicesService.currentUserValue?.email;

    // 【步驟 2】增加防護，確保 email 存在
    if (!currentUserEmail) {
      this.triggerAlertService.trigger('無法獲取使用者資訊，請重新登入後再試', 'error');
      this.isSaving = false; // 發生錯誤，也要重設載入狀態
      return;
    }

    const merchantData = {
      name: this.businessData.name,
      description: this.businessData.description,
      addressText: this.businessData.address,
      phoneNumber: this.businessData.phone,
      contactEmail: this.businessData.email,
      createdByEmail: currentUserEmail,
      openingHoursDescription,
      isActive: true,
      approvedByAdminId: 123,
      logoUrl: this.images.logo,
      bannerImageUrl: this.images.banner,
      mapScreenshotUrl: this.images.map,
      mapGoogleUrl: this.businessData.googleMapUrl, // ❗可留空
      pickupInstructions: this.businessData.pickupInstructions
    };

    this.httpClientService.postApi('http://localhost:8080/merchants/register', merchantData)
      .pipe(
        // --- 【整合點 2】使用 finalize 來確保 loading 狀態一定會被關閉 ---
        finalize(() => {
          this.isSaving = false;
        })
      )
      .subscribe({
        next: (res) => {
          console.log('註冊成功:', res);
          this.triggerAlertService.trigger('完成註冊流程', 'success');
          this.viewMode = 'preview';
        },
        error: (error) => {
          console.error('註冊失敗:', error);
          this.triggerAlertService.trigger('註冊失敗，請稍後再試', 'error');
        }
      });

    console.log('儲存商家資料:', {
      businessData: this.businessData,
      businessHours: this.businessHours,
      images: this.images
    });
  }


  // backToEdit(): void {
  //   this.viewMode = 'edit';
  // }

  storeList(): void {
    this.router.navigate(['/storeList']);
  }

  GoToChange(): void {
    (document.activeElement as HTMLElement)?.blur();
    this.router.navigate(['/profile-edit']);
  }

  // 登出方法
  logout(): void {
    this.UsersServicesService.LoginOutNow();
  }
}
