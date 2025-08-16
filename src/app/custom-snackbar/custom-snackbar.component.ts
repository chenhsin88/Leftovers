import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common'; // 必須引入才能使用 *ngFor
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBarRef,
} from '@angular/material/snack-bar';

// 為了讓程式碼更清晰，我們先定義好傳入資料的格式
export interface CustomSnackbarData {
  title: string;
  items: { name: string; price: string | number }[];
}

@Component({
  selector: 'app-custom-snackbar',
  standalone: true,
  imports: [CommonModule], // 確保 CommonModule 已加入 imports
  templateUrl: './custom-snackbar.component.html',
  styleUrls: ['./custom-snackbar.component.scss'],
})
export class CustomSnackbarComponent {
  // 透過建構子注入 (Inject) 兩樣重要的東西：
  // 1. MAT_SNACK_BAR_DATA: 這就是我們從主程式傳進來的資料 (一個物件)
  // 2. MatSnackBarRef: 這是對當前 Snackbar 本身的參照，可以用來關閉它
  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public data: CustomSnackbarData,
    public snackBarRef: MatSnackBarRef<CustomSnackbarComponent>
  ) {}
}
