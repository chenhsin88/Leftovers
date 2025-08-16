import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class HttpClientService {

  constructor(private httpClient: HttpClient) { }

  getApi<T>(url: string) {
    return this.httpClient.get<T>(url);
  }

  postApi<T = any>(url: string, body: any): Observable<T> {
    return this.httpClient.post<T>(url, body);
  }

  putApi(url: string, postData: any) {
    return this.httpClient.put(url, postData);
  }

  deleteApi(url: string) {
    return this.httpClient.delete(url);
  }
}
