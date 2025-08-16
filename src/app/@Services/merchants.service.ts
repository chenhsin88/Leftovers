import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import{ map, catchError } from 'rxjs/operators';
import { UsersServicesService } from './users-services.service';
import { HttpClient } from '@angular/common/http';
@Injectable({
  providedIn: 'root'
})
export class MerchantsService {
  private storeId: string | null = null;

  private _userHasStores: boolean | null = null;

  constructor(
    private userservice: UsersServicesService,
    private http: HttpClient
  ) {}

  // 設置 storeId
  setStoreId(storeId: string): void {
    this.storeId = storeId;
  }

  // 獲取 storeId
  getStoreId(): string | null {
    return this.storeId;
  }

  public checkAndCacheUserHasStores(): Observable<boolean> {
    // 檢查快取：如果不是 null，代表之前檢查過了，直接回傳快取的結果
    if (this._userHasStores !== null) {
      console.log(`[UserService] 快取命中！使用者擁有店家狀態: ${this._userHasStores}`);
      return of(this._userHasStores);
    }

    // 快取未命中：執行 API 呼叫
    const currentUserEmail = this.userservice.currentUserValue?.email;
    if (!currentUserEmail) {
      return of(false); // 如果沒有使用者資訊，直接判定為 false
    }

    console.log('[UserService] 快取未命中，透過 API 檢查店家狀態...');
    const payload = { createdByEmail: currentUserEmail };

    interface MerchantCheckResponse {
        code: number;
        merchants: any[];
    }

    return this.http.post<MerchantCheckResponse>('http://localhost:8080/merchants/getMerchantsData', payload).pipe(
      map(response => {
        const hasStores = response && response.code === 200 && response.merchants && response.merchants.length > 0;

        // 將 API 結果存入快取
        this._userHasStores = hasStores;
        console.log(`[UserService] API 檢查完畢，店家狀態: ${hasStores}，已存入快取。`);

        return hasStores;
      }),
      catchError(err => {
        console.error('[UserService] 檢查店家狀態時發生錯誤', err);
        // 發生錯誤時，也判定為 false，避免使用者卡住
        return of(false);
      })
    );
  }

  public clearCache(): void {
    console.log('[MerchantsService] 已清除店家狀態快取。');
    this._userHasStores = null;
  }

}

