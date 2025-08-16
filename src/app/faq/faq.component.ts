import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

// Q&A項目的介面定義
interface QAItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq',
  imports: [CommonModule],
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss']
}) export class FaqComponent {
  constructor(private router: Router) { }

  // 目前展開的項目索引，-1表示都沒有展開
  activeIndex: number = -1;

  // Q&A資料陣列
  qaItems: QAItem[] = [
    {
      question: '什麼是剩食？',
      answer: '剩食是指在食物供應鏈的各個階段中，原本可以食用但被丟棄的食物。包括餐廳未售完的食物、超市接近保存期限的商品、家庭準備過多的食材等。這些食物在品質上仍然安全可食用，但因為各種原因而面臨被浪費的命運。'
    },
    {
      question: '為什麼要關注剩食問題？',
      answer: '全球每年約有三分之一的食物被浪費，這不僅造成經濟損失，也對環境產生嚴重影響。食物浪費會產生溫室氣體、浪費水資源和土地。同時，在許多地方仍有人面臨食物不足的問題，減少剩食浪費可以幫助解決食物分配不均的社會問題。'
    },
    {
      question: '如何安全地處理剩食？',
      answer: '處理剩食時要注意食物安全：檢查食物外觀、氣味和保存期限；確保食物在適當溫度下保存；加熱食物時要達到安全溫度；避免處理已經變質或超過安全期限的食物。建議優先選擇包裝完整、保存良好的剩食。'
    },
    {
      question: '個人可以如何參與剩食回收？',
      answer: '個人可以透過多種方式參與：使用剩食分享APP尋找附近的剩食；關注社區剩食分享活動；在餐廳用餐時適量點餐；購買接近期限的打折商品；將家中多餘食材分享給鄰居朋友；支持有剩食回收計畫的商家。'
    },
    {
      question: '剩食和過期食品有什麼差別？',
      answer: '剩食通常指的是仍在保存期限內或剛過期但品質良好的食物，而過期食品是指已經超過安全食用期限的食物。需要注意「最佳賞味期限」和「使用期限」的差別：前者過期後品質可能下降但通常仍可安全食用，後者過期後可能存在食安風險。'
    },
    {
      question: '企業如何參與剩食回收？',
      answer: '企業可以建立剩食捐贈機制，與慈善機構合作；設立員工剩食分享平台；改善庫存管理減少過度採購；提供消費者剩食回收的誘因（如折扣優惠）；參與食物銀行計畫；開發剩食再利用的創新產品。'
    },
    {
      question: '剩食回收的法律考量有哪些？',
      answer: '在進行剩食回收時需要注意相關法規：食品安全衛生管理法規定；捐贈食物的責任歸屬；商業剩食處理的合規要求；個人分享食物的法律風險。建議在參與剩食回收前了解當地相關法規，確保活動的合法性和安全性。'
    },
    {
      question: '如何判斷剩食是否還能安全食用？',
      answer: '判斷剩食安全性的基本原則：外觀是否正常（無發霉、變色）；氣味是否正常（無異味、酸味）；觸感是否正常（無黏膩感）；包裝是否完整；保存條件是否適當；是否在合理的時間範圍內。如有任何疑慮，建議不要食用。'
    },
    {
      question: '如何連絡客服？',
      answer: '若您有任何疑問、建議，歡迎隨時透過以下方式與我們的客服團隊聯繫：leftoverstest@gmail.com'
    }
  ];

  /**
   * 切換答案顯示狀態
   * @param index 點擊的項目索引
   */
  toggleAnswer(index: number): void {
    // 如果點擊的是已經展開的項目，則收合；否則展開新項目
    this.activeIndex = this.activeIndex === index ? -1 : index;
  }
}
