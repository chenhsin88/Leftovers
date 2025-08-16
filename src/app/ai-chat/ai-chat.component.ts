// ai-chat.component.ts

import { UsersServicesService, UserVo } from './../@Services/users-services.service';
import { AiChatService } from './../@Services/ai-chat.service';
import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core'; // 移除 AfterViewChecked
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';

// 引入 GSAP 和 Draggable
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';

// 註冊 Draggable 插件
gsap.registerPlugin(Draggable);

interface Message {
  author: 'user' | 'ai';
  content: string;
}

@Component({
  selector: 'app-ai-chat',
  // standalone: true, // 根據您的專案設定，這裡可能需要註解或保持
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.scss']
})
export class AiChatComponent implements OnInit, OnDestroy { // 移除 AfterViewChecked
  @ViewChild('chatWindow') private chatWindow!: ElementRef<HTMLDivElement>;
  @ViewChild('chatBody') private chatBodyContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('dragHandle') private dragHandle!: ElementRef<HTMLDivElement>;

  isOpen = false;
  isLoading = false;
  userInput = '';
  messages: Message[] = [];

  private draggableInstance: Draggable | null = null;
  isLoggedIn$: Observable<boolean>;
  currentUser$: Observable<UserVo | null>;
  private userSubscription!: Subscription;

  constructor(
    private aiChatService: AiChatService,
    private userService: UsersServicesService
  ) {
    this.isLoggedIn$ = this.userService.isLoggedIn$;
    this.currentUser$ = this.userService.currentUser$;
  }

  ngOnInit(): void {
    // 訂閱登入狀態，當使用者登出時重設對話
    this.userSubscription = this.isLoggedIn$.subscribe(isLoggedIn => {
      if (!isLoggedIn) {
        this.aiChatService.resetConversation();
        this.messages = [];
        this.isOpen = false;
      }
    });
  }

  // ▼▼▼【已移除】ngAfterViewChecked 方法 ▼▼▼

  // 在元件銷毀時取消訂閱，避免記憶體洩漏
  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  private initDraggable(): void {
    if (this.chatWindow && this.dragHandle) {
      this.draggableInstance = Draggable.create(this.chatWindow.nativeElement, {
        trigger: this.dragHandle.nativeElement,
        bounds: window,
        inertia: true,
        type: "top,left"
      })[0];
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.chatBodyContainer) {
        this.chatBodyContainer.nativeElement.scrollTop = this.chatBodyContainer.nativeElement.scrollHeight;
      }
    } catch (err) { }
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      if (this.messages.length === 0) {
        this.messages.push({ author: 'ai', content: '您好！我是您的AI助理，您需要找點什麼嗎？' });
        // ▼▼▼【新增】確保 DOM 更新後再滾動 ▼▼▼
        setTimeout(() => this.scrollToBottom(), 0);
      }
      gsap.to(this.chatWindow.nativeElement, {
        duration: 0.4,
        autoAlpha: 1,
        y: 0,
        scale: 1,
        ease: 'power3.out',
        onComplete: () => {
          this.initDraggable();
        }
      });
    } else {
      gsap.to(this.chatWindow.nativeElement, {
        duration: 0.3,
        autoAlpha: 0,
        y: 20,
        scale: 0.95,
        ease: 'power3.in'
      });
    }
  }

  sendMessage(): void {
    if (!this.userInput.trim()) return;

    const userMessage = this.userInput;
    this.messages.push({ author: 'user', content: userMessage });
    // ▼▼▼【新增】確保 DOM 更新後再滾動 ▼▼▼
    setTimeout(() => this.scrollToBottom(), 0);
    this.userInput = '';
    this.isLoading = true;

    const currentUser = this.userService.currentUserValue;
    const location = this.userService.locationValue;

    if (!currentUser) {
      this.messages.push({ author: 'ai', content: '錯誤：無法取得使用者資訊，請重新登入。' });
      this.isLoading = false;
      // ▼▼▼【新增】確保 DOM 更新後再滾動 ▼▼▼
      setTimeout(() => this.scrollToBottom(), 0);
      return;
    }

    this.aiChatService.sendMessage(
      userMessage,
      currentUser.email,
      location ? parseFloat(location.lat) : undefined,
      location ? parseFloat(location.lon) : undefined
    ).subscribe({
      next: (response) => {
        this.messages.push({ author: 'ai', content: response.reply });
        this.isLoading = false;
        // ▼▼▼【新增】確保 DOM 更新後再滾動 ▼▼▼
        setTimeout(() => this.scrollToBottom(), 0);
      },
      error: (err) => {
        this.messages.push({ author: 'ai', content: err.message });
        this.isLoading = false;
        // ▼▼▼【新增】確保 DOM 更新後再滾動 ▼▼▼
        setTimeout(() => this.scrollToBottom(), 0);
      }
    });
  }

  public formatMessage(content: string): string {
    if (!content) {
      return '';
    }
    return content.replace(/\n/g, '<br>');
  }

  public startNewConversation(): void {
    this.aiChatService.resetConversation();
    this.messages = [];
    this.messages.push({ author: 'ai', content: '您好！我是您的剩食獵人助理，需要找點什麼嗎？' });
    // ▼▼▼【新增】確保 DOM 更新後再滾動 ▼▼▼
    setTimeout(() => this.scrollToBottom(), 0);
    this.userInput = '';
    this.isLoading = false;
  }
}
