// location.component.ts
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  AfterViewInit,
  ViewChildren,
  QueryList
} from '@angular/core';
import { gsap } from 'gsap';
import { TriggerAlertService } from '../@Services/trigger-alert.service';
import { ActivatedRoute, Router } from '@angular/router';
import { UsersServicesService } from '../@Services/users-services.service';

@Component({
  selector: 'app-location',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './location.component.html',
  styleUrls: ['./location.component.scss']
})
export class LocationComponent implements OnInit, AfterViewInit {
  /** 標題字元*/
  public titleWords = ['定', '位', '您', '的', '位', '置'];
 private returnUrl: string = '';
  /** 完整地址 & 各段欄位 */
  public addressInput = '';
  public finalAddress = '';
  public postcode = '';
  public city = '';
  public district = '';    // 現在由 addr.suburb or 手動輸入
  public suburb = '';      // 暫不自動填
  public road = '';
  public houseNumber = '';

  /** 狀態訊息 & 經緯度 */
  public statusMessage = '請點擊按鈕或手動輸入地址';
  public confirmedCoordinates?: { lat: string; lon: string };
  public isLocating = false;
  public inputFocused = false;

  /** 標記：自動定位後不再走結構化查詢 */
  private isAutoDetected = false;

  /** 建物名稱 fallback */
  private buildingMapping: { [key: string]: string } = {
    '復興四路 2-10': '國城UFO B棟'
  };

  @ViewChild('glassCard')    card!: ElementRef;
  @ViewChildren('titleWord') titleWordEls!: QueryList<ElementRef>;

  constructor(
    private http: HttpClient,
    private userService: UsersServicesService,
    private router: Router,
    private triggerAlertService: TriggerAlertService,
     private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {

    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/main';
    console.log(`[LocationComponent] 初始化的 returnUrl 為: ${this.returnUrl}`);
  }

  ngAfterViewInit(): void {
    if (this.card && this.titleWordEls.length > 0) {
      this.initAnimations();
    }
  }

  /** 根據當前各欄位拼出完整地址 */
  private formatAddress(): string {
    const parts: string[] = [];
    if (this.postcode) parts.push(this.postcode);
    parts.push(this.city + this.district);
    parts.push(`${this.road}${this.houseNumber}`);
    const building = this.buildingMapping[`${this.road} ${this.houseNumber}`] || '';
    if (building) parts.push(building);
    parts.push('臺灣');
    const formatted = parts.join(' ');
    console.log('[Format] Formatted address:', formatted);
    return formatted;
  }

  /** 自動定位流程 */
  public getUserLocation(): void {
    if (this.isLocating) return;
    this.isLocating    = true;
    this.statusMessage = '正在定位您的位置…';
    console.log('[Auto] Starting automatic location detection...');

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.confirmedCoordinates = {
          lat: coords.latitude.toString(),
          lon: coords.longitude.toString()
        };
        this.isAutoDetected = true;
        console.log('[Auto] Geolocation successful. Coords:', this.confirmedCoordinates);

        this.reverseGeocode(coords.latitude, coords.longitude).subscribe({
          next: rev => {
            console.log('[Auto] Reverse geocode response:', rev);
            const addr = rev.address;
            this.postcode    = addr.postcode       ?? '';
            this.city        = addr.city           ?? addr.state ?? '';
            this.district    = addr.suburb         ?? '';
            this.road        = addr.road           ?? '';
            this.houseNumber = addr.house_number   ?? '';
            this.suburb      = '';

            this.finalAddress  = this.formatAddress();
            this.addressInput  = this.finalAddress;
            this.statusMessage = '自動定位成功，請確認或修改地址';
            this.isLocating    = false;
          },
          error: (err) => {
            console.error('[Auto] Reverse geocoding failed:', err);
            this.statusMessage = '反向地理編碼失敗';
            this.isLocating    = false;
          }
        });
      },
      () => {
        console.error('[Auto] Geolocation permission denied or failed.');
        this.statusMessage = '定位失敗，請檢查瀏覽器權限';
        this.isLocating    = false;
      }
    );
  }

  private reverseGeocode(lat: number, lon: number): Observable<any> {
    const params = new HttpParams()
      .set('format','json')
      .set('lat',lat.toString())
      .set('lon',lon.toString())
      .set('addressdetails','1')
      .set('accept-language','zh-TW')
      .set('email','leftoverstest@gmail.com');
    return this.http.get('https://nominatim.openstreetmap.org/reverse',{ params });
  }

  /** 確認按鈕 */
  public confirmLocation(): void {
    console.log('[Confirm] Confirm button clicked.');
    if (this.isAutoDetected && this.confirmedCoordinates) {
      console.log('[Confirm] Auto-detected location confirmed. Skipping new search.');
      this.saveAndNavigate();
    } else {
      console.log('[Confirm] Manual address input. Starting structured location search.');
      this.confirmStructuredLocation();
    }
  }

  /** 手動結構化查詢 */
  private confirmStructuredLocation(): void {
    if (!this.city || !this.district || !this.road || !this.houseNumber) {
      this.statusMessage = '請完整填寫：城市、行政區(里／鄰)、路名、門牌';
      return;
    }
    this.isLocating = true;
    this.statusMessage = '正在查詢結構化地址…';

    const fullAddress = `${this.city}${this.district}${this.road}${this.houseNumber}`;
    console.log(`[Manual] Starting structured query for: ${fullAddress}`);
    this.executeGeocodeQuery(fullAddress);
  }

  /**
   * 執行地理編碼查詢，並包含降級邏輯
   * @param addressToSearch 要查詢的地址
   * @param isFallback 是否為降級查詢
   */
  private executeGeocodeQuery(addressToSearch: string, isFallback = false): void {
    console.log(`[API] Executing geocode query for: "${addressToSearch}". Is fallback: ${isFallback}`);
    const params = new HttpParams()
      .set('q', addressToSearch)
      .set('countrycodes', 'tw')
      .set('format', 'json')
      .set('limit', '1')
      .set('addressdetails', '1')
      .set('accept-language', 'zh-TW')
      .set('email', 'leftoverstest@gmail.com');

    this.http.get<any[]>( 'https://nominatim.openstreetmap.org/search', { params })
      .subscribe({
        next: resp => {
          console.log('[API] Response received:', resp);
          if (resp.length > 0) {
            const loc = resp[0];
            console.log('[API] Query successful. Location found:', loc);
            this.confirmedCoordinates = { lat: loc.lat, lon: loc.lon };
            if (isFallback) {
              this.statusMessage = '正在努力尋找請稍後...';
            } else {
              this.statusMessage = '地址查詢成功！';
            }

            this.reverseGeocode(+loc.lat, +loc.lon).subscribe({
              next: rev => {
                console.log('[API] Reverse geocode successful. Standardized address:', rev.address);
                const addr = rev.address;
                this.postcode    = addr.postcode     ?? '';
                this.city        = addr.city         ?? this.city;
                this.district    = addr.suburb       ?? this.district;
                this.road        = addr.road         ?? this.road;
                this.houseNumber = addr.house_number ?? this.houseNumber;
                this.finalAddress = this.formatAddress();
                this.addressInput = this.finalAddress;
                this.saveAndNavigate();
              },
              error: (err) => {
                console.error('[API] Reverse geocode failed after successful search. Saving coordinates only.', err);
                this.statusMessage = '反向地理編碼失敗，但已取得座標';
                this.saveAndNavigate();
              }
            });

          } else {
            if (!isFallback) {
              console.log('[API] Full address query failed. Attempting fallback to street level...');
              const fallbackAddress = `${this.city}${this.district}${this.road}`;
              this.executeGeocodeQuery(fallbackAddress, true);
            } else {
              console.error('[API] Fallback query also failed. Cannot find location.');
              this.statusMessage = '找不到此地址，請確認城市、行政區與路名是否正確。';
              this.isLocating = false;
            }
          }
        },
        error: err => {
          console.error('[API] Geocode query HTTP call failed:', err);
          this.statusMessage = '地址轉換服務出錯';
          this.isLocating = false;
        }
      });
  }

  /** 存入 service 並跳頁 */
  private saveAndNavigate(): void {
    if (!this.confirmedCoordinates) {
        this.triggerAlertService.trigger('無法儲存，座標不存在', 'error');
        return;
    }

    // ★ 不再是 this.userService.mylocation = ...
    // ★ 而是呼叫新的 setLocation 方法來設定並廣播狀態
    this.userService.setLocation(this.confirmedCoordinates);

    console.log(`位置設定完畢，準備導航至 returnUrl: ${this.returnUrl}`);
    this.router.navigateByUrl(this.returnUrl);
  }

  public onInputFocus(): void {
    console.log('[Input] Focus on input field. Resetting auto-detection flag.');
    this.inputFocused  = true;
    this.statusMessage = '請輸入您的完整地址…';
    this.isAutoDetected = false;
  }
  public onInputBlur(): void {
    this.inputFocused = false;
    if (!this.addressInput.trim()) {
      this.statusMessage = '請選擇定位方式';
    }
  }

  private initAnimations(): void {
    const tl = gsap.timeline({ defaults:{ ease:'power3.out' } });
    tl.from(this.card.nativeElement,{ duration:1, opacity:0, y:50, scale:0.95 })
      .from(this.titleWordEls.map(el=>el.nativeElement),{ duration:0.8, opacity:0, y:20, stagger:0.1, delay:-0.5 });
  }
}
