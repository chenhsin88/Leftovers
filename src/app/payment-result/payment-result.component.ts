import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-payment-result',
  standalone: true, // 建議使用獨立元件
  imports: [CommonModule],
  templateUrl: './payment-result.component.html',
  styleUrl: './payment-result.component.scss'
})
export class PaymentResultComponent implements OnInit {
  paymentStatus: string | null = null;

  // ✅ 產生更多彩紙，並為每個彩紙設定隨機的屬性
  confettiItems: { delay: number; left: number }[] = [];

  constructor(private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
    // 從 URL 查詢參數中讀取 status
    this.route.queryParamMap.subscribe(params => {
      this.paymentStatus = params.get('status');
    });

    // ✅ 動態生成 30 個彩紙項目
    this.confettiItems = Array.from({ length: 30 }, () => ({
      delay: Math.random() * 4,     // 隨機動畫延遲 0 到 4 秒
      left: Math.random() * 100     // 隨機水平位置 0% 到 100%
    }));
  }

  continueShopping() {
    this.router.navigate(['/main']);
  }
}
