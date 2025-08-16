import { Component } from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import { HttpClientService } from "../@http-services/http.service"
import { ActivatedRoute } from "@angular/router"
import { ConfirmationService } from "../@Services/confirmation.service"
import { TriggerAlertService } from "../@Services/trigger-alert.service"
import { finalize } from "rxjs/operators"; // 👈 導入 finalize


// 評論資料介面定義
interface Review {
  orderId: number // 使用 orderId 作為唯一識別符
  userName: string
  userAvatar: string
  rating: number
  comment: string
  createdAt: string
  merchantName: string
  storeReply?: {
    merchantId: number | null
    merchantReply: string
    merchantReplyAt: string
  }
}

@Component({
  selector: "app-review-reply",
  standalone: true, // Angular 17 獨立組件
  imports: [CommonModule, FormsModule], // 導入必要模組
  templateUrl: "./review-reply.component.html",
  styleUrls: ["./review-reply.component.scss"],
})
export class ReviewReplyComponent {

  // --- 狀態屬性 ---
  public isLoading: boolean = true;
  public hasReviews: boolean = false;

  constructor(
    private httpClientService: HttpClientService,
    private route: ActivatedRoute,
    public triggerAlertService: TriggerAlertService,
    public confirmationService: ConfirmationService
  ) { }

  // 回覆文字內容物件（以 orderId 為 key）
  replyTexts: { [key: number]: string } = {}

  // 顯示回覆表單狀態物件（以 orderId 為 key）
  showReplyForm: { [key: number]: boolean } = {}

  // 編輯狀態物件（以 orderId 為 key）
  editReplyMode: { [key: number]: boolean } = {}

  // 暫存編輯文字內容
  editedReplies: { [key: number]: string } = {}

  reviews: Review[] = [];
  storeId: string | null = null;

  ngOnInit(): void {
    this.route.parent?.paramMap.subscribe(params => {
      this.storeId = params.get('storeId');
      if (this.storeId) {
        this.fetchReviews(this.storeId);
      } else {
        console.error("無法從路由獲取 storeId");
        this.isLoading = false;
        this.hasReviews = false;
      }
    });
  }

  fetchReviews(merchantId: string): void {
    this.isLoading = true; // 開始載入
    this.httpClientService.getApi(`http://localhost:8080/reviews/merchant?merchants=${merchantId}`)
      .pipe(
        finalize(() => {
          this.isLoading = false; // 不論成功或失敗，最後都結束載入
        })
      )
      .subscribe({
        next: (response: any) => {
          console.log("response:", response);
          // 檢查回傳的資料是否存在且陣列長度大於 0
          if (response.code === 200 && response.reviewsVo && response.reviewsVo.length > 0) {
            this.hasReviews = true; // 有評論
            this.reviews = response.reviewsVo.map((review: any) => ({
              rating: review.rating,
              comment: review.comment,
              createdAt: this.formatDate(new Date(review.createdAt).toISOString()),
              orderId: review.orderId,
              userName: review.userName,
              merchantName: review.merchant,
              storeReply: review.merchantReply ? {
                merchantId: review.merchantId,
                merchantReply: review.merchantReply,
                merchantReplyAt: this.formatDate(new Date(review.merchantReplyAt).toISOString()),
              } : undefined
            }));

            this.reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          } else {
            this.hasReviews = false; // 沒有評論
            this.reviews = []; // 清空陣列
            console.log('查無評論');
          }
        },
        error: (error) => {
          this.hasReviews = false; // 發生錯誤也視為無資料
          console.error('API 請求失敗:', error);
        }
      });
  }


  private formatDate(date: string): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");

    return `${year}/${month}/${day} ${hours}:${minutes}`;
  }

  // 編輯回覆
  editReply(orderId: number): void {
    const review = this.reviews.find(r => r.orderId === orderId);
    if (review?.storeReply) {
      this.editedReplies[orderId] = review.storeReply.merchantReply;
      this.editReplyMode[orderId] = true;
    }
  }

  // 編輯回覆保存
  saveEditedReply(orderId: number): void {
    const newText = this.editedReplies[orderId]?.trim();
    if (!newText) return;

    const review = this.reviews.find(r => r.orderId === orderId);
    if (!review) return;

    const body = {
      merchantReply: newText
    };

    this.httpClientService.postApi(`http://localhost:8080/reviews/${orderId}/${review.userName}/${this.storeId}/reply`, body).subscribe({
      next: (res: any) => {
        if (res.code === 200) {
          review.storeReply = {
            merchantId: Number(this.storeId),
            merchantReply: newText,
            merchantReplyAt: this.formatDate(new Date().toISOString())
          };
          this.editReplyMode[orderId] = false;
          delete this.editedReplies[orderId];
          this.triggerAlertService.trigger('編輯成功', 'success');

        } else {
          console.error("API 回覆錯誤：", res.message);
          this.triggerAlertService.trigger('編輯失敗，請稍後再試', 'error');
        }
      },
      error: (err) => {
        console.error("回覆更新失敗：", err);
        this.triggerAlertService.trigger('編輯失敗，請稍後再試', 'error');
      }
    });
  }

  // 編輯狀態取消
  cancelEditReply(orderId: number): void {
    this.editReplyMode[orderId] = false;
    delete this.editedReplies[orderId];
  }

  // 刪除回覆
  deleteReply(orderId: number): void {
    const review = this.reviews.find(r => r.orderId === orderId);
    if (!review?.storeReply) return;

    // 先彈出確認框
    this.confirmationService.open("你確定要刪除這則回覆嗎？").subscribe((confirmed) => {
      if (!confirmed) return; // 使用者取消

      const body = {};
      this.httpClientService
        .postApi(`http://localhost:8080/reviews/${orderId}/${review.userName}/${this.storeId}/delete`, body)
        .subscribe({
          next: (res: any) => {
            if (res.code === 200) {
              delete review.storeReply;
              console.log("回覆已成功刪除");
              this.triggerAlertService.trigger('刪除成功', 'success');
            } else {
              console.error("刪除回覆 API 錯誤：", res.message);
            }
          },
          error: (err) => {
            console.error("刪除回覆失敗：", err);
            this.triggerAlertService.trigger('刪除失敗，請稍後再試', 'error');

          }
        });
    });
  }

  // 產生星級評分陣列
  getStarsArray(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, index) => index < rating);
  }

  // 切換回覆表單顯示狀態
  toggleReplyForm(orderId: number): void {
    this.showReplyForm[orderId] = !this.showReplyForm[orderId];

    if (!this.showReplyForm[orderId]) {
      this.replyTexts[orderId] = "";
    }
  }

  // 提交回覆
  submitReply(orderId: number): void {
    const replyText = this.replyTexts[orderId];

    if (!replyText?.trim()) return;

    const review = this.reviews.find(r => r.orderId === orderId);
    if (!review) return;

    const body = {
      merchantReply: replyText.trim()
    };

    this.httpClientService.postApi(`http://localhost:8080/reviews/${orderId}/${review.userName}/${this.storeId}/reply`, body).subscribe({
      next: (res: any) => {
        if (res.code === 200) {
          review.storeReply = {
            merchantId: Number(this.storeId),
            merchantReply: body.merchantReply,
            merchantReplyAt: this.formatDate(new Date().toISOString())
          };
          this.replyTexts[orderId] = "";
          this.showReplyForm[orderId] = false;
          this.triggerAlertService.trigger('提交成功', 'success');
        } else {
          console.error("API 回覆錯誤：", res.message);
        }
      },
      error: (err) => {
        console.error("提交回覆失敗：", err);
        this.triggerAlertService.trigger('提交失敗：', 'error');
      }
    });
  }

  // 取消回覆
  cancelReply(orderId: number): void {
    this.replyTexts[orderId] = "";
    this.showReplyForm[orderId] = false;
  }
}
