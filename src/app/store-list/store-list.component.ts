import { TriggerAlertService } from './../@Services/trigger-alert.service';
import { UsersServicesService } from './../@Services/users-services.service';
import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClientService } from '../@http-services/http.service';
import { SafeUrlPipe } from '../safe-url.pipe';
import { gsap } from "gsap";
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

// ✅ 對應後端回傳格式
interface Merchant {
  merchantsId: number;
  name: string;
  addressText: string;
  phoneNumber: string;
}

interface MerchantResponse {
  code: number;
  message: string;
  merchants: Merchant[];
}


@Component({
  selector: 'app-store-list',
  imports: [CommonModule, FormsModule, SafeUrlPipe, MatIconModule, RouterLink, MatButtonModule],
  templateUrl: './store-list.component.html',
  styleUrl: './store-list.component.scss'
})
export class StoreListComponent {
  constructor(
    private router: Router,
    private httpClientService: HttpClientService,
    private UsersServicesService: UsersServicesService,
    private TriggerAlertService: TriggerAlertService
  ) { }


  IconShowOrNot: boolean = false;
  LightDarkContolIsChoose: boolean = false;

  // ✅ 直接使用後端資料型別
  stores: Merchant[] = [];
  profilePictureUrl: string = '';
  public showDisclaimer = true;
  public disclaimerAccepted = false;
  private currentUserEmail: string = ''; // 用來儲存當前使用者 Email

  // ✅ 4. 新增控制按鈕顯示的屬性
  showScrollToTopButton: boolean = false;

  // ✅ 5. 加上 HostListener 來監聽 window 的捲動事件
  @HostListener('window:scroll', [])
  onWindowScroll() {
    const yOffset = window.pageYOffset;
    if (yOffset > 200) {
      this.showScrollToTopButton = true;
    } else {
      this.showScrollToTopButton = false;
    }
  }

  // ✅ 6. 新增一個回到頂部的方法
  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  ngOnInit(): void {
    this.profilePictureUrl = this.UsersServicesService.currentUserValue?.profilePictureUrl || ''; // 使用 || '' 避免 null 或 undefined
    const createdByEmail = this.UsersServicesService.currentUserValue?.email;
    this.currentUserEmail = createdByEmail || ''; // 儲存 Email
    const payload = { createdByEmail };

    if (this.currentUserEmail) {
      const storageKey = 'disclaimer_agreed_' + this.currentUserEmail;
      if (localStorage.getItem(storageKey) === 'true') {
        this.showDisclaimer = false;
      } else {
        this.showDisclaimer = true;
        this.preventBodyScroll();
      }
    } else {
      // 理論上商家列表頁面不會有未登入狀態，但做個保護
      this.showDisclaimer = true;
      this.preventBodyScroll();
    }

    this.httpClientService.postApi<MerchantResponse>('http://localhost:8080/merchants/getMerchantsData', payload)
      .subscribe({
        next: (res) => {
          console.log(res);
          if (res.code === 200 && Array.isArray(res.merchants)) {
            this.stores = res.merchants;
          } else {
            console.warn('格式不符或無資料', res);
            this.TriggerAlertService.trigger('您尚未建立店家資料請先建立', 'warning', 4000);
            this.router.navigate(['/merchantRegistration']);
          }
        },
        error: (err) => {
          console.error('取得商家資料失敗:', err);
        }
      });
  }
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

  // 導航到使用者個人資料頁面
  GoToChange(): void {
    // 在跳轉頁面前，讓當前活動元素失去焦點，這會自動關閉 dropdown
    (document.activeElement as HTMLElement)?.blur();

    // 接著執行原本的頁面跳轉邏輯
    this.router.navigate(['/profile-edit']);
  }

  /**
 * 當用戶點擊「同意並繼續」按鈕時觸發
 */
  public agreeToDisclaimer(): void {
    if (this.disclaimerAccepted) {
      if (this.currentUserEmail) {
        const storageKey = 'disclaimer_agreed_' + this.currentUserEmail;
        localStorage.setItem(storageKey, 'true');
      }
      this.showDisclaimer = false;
      document.body.style.overflow = '';
    }
  }

  /**
   * 當 Modal 顯示時，禁止背景滾動
   */
  public preventBodyScroll(): void {
    document.body.style.overflow = 'hidden';
  }

  /**
   * 查看店家詳情
   * @param storeId 店家ID
   */
  viewStoreDetails(storeId: number): void {
    const selectedStore = this.stores.find(store => store.merchantsId === storeId);
    if (selectedStore) {
      // this.merchantsService.setSelectedMerchant(selectedStore);
      this.router.navigate(['/merchants', storeId, 'storeManagement']);// 導航到 StoreManagementComponent
      console.log(storeId)
    } else {
      console.warn('找不到該店家');
    }
  }

  /**
   * 新增店家
   */
  addNewStore(): void {
    this.router.navigate(['/merchantRegistration']);
  }

  /**
   * TrackBy 函數，提升 *ngFor 效能
   * @param index 索引
   * @param store 店家物件
   * @returns 店家ID
   */
  trackByStoreId(index: number, store: Merchant): number {
    return store.merchantsId
  }

  // 登出方法
  logout(): void {
    this.UsersServicesService.LoginOutNow();
  }
}
