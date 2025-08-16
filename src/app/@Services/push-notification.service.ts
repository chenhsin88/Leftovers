// src/app/services/push-notification.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HttpClientService } from '../@http-services/http.service';

export interface Product {
  id: number;
  productName: string;
  description: string;
  originalPrice: number;
  discountPrice: number;
  finalPrice: number;
  image: string;
  pickupTime: string;
  merchantName: string;
  merchantAddress: string;
  badge?: string;
  isAdded?: boolean;
}

export interface PushNotificationRequest {
  latitude: number;
  longitude: number;
  range: number; // 公里
  category?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private apiUrl = 'http://localhost:8080/pushNotificationTokens/getUserUI';

  constructor(private httpClientService: HttpClientService,
  ) { }

  getUserUIData(req: PushNotificationRequest): Observable<Product[]> {
    return this.httpClientService.postApi<Product[]>(this.apiUrl, req);
  }
}
