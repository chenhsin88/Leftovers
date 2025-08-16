// src/app/firstshowpage/firstshowpage.component.ts
import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common'; // standalone 元件通常需要
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

@Component({
  selector: 'app-firstshowpage',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './firstshowpage.component.html',
  styleUrls: ['./firstshowpage.component.scss']
})
export class FirstshowpageComponent implements AfterViewInit, OnDestroy {

  @ViewChild('bg1ScrollTarget') bg1Ref!: ElementRef<HTMLDivElement>;
  @ViewChild('beachImage') beachImageRef!: ElementRef<HTMLImageElement>;
  private ctx!: gsap.Context;

  constructor(private router: Router) {
    // 假設 GSAP 插件已在 AppComponent 或 main.ts 全局註冊一次
  }
  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    //Add 'implements OnInit' to the class.
     gsap.registerPlugin(ScrollTrigger);
  }
  ngAfterViewInit(): void {
    // 延遲以確保 DOM 完全穩定
    setTimeout(() => {
      if (this.bg1Ref?.nativeElement && this.beachImageRef?.nativeElement) {
        this.setupAnimations();
      } else {
        console.error("FirstshowpageComponent: 動畫元素未找到。");
      }
    }, 100);
  }

 setupAnimations(): void {
  if (this.ctx) { this.ctx.revert(); } // 清理舊的動畫，以防萬一

  this.ctx = gsap.context(() => {
    // 圖片放大和釘選動畫
    gsap.to(this.beachImageRef.nativeElement, {
      scale: 1.5,
      ease: "none",
      force3D: true,
      scrollTrigger: {
        trigger: this.bg1Ref.nativeElement,
        pin: this.bg1Ref.nativeElement,
        start: "top top",
        end: () => "+=" + ((this.bg1Ref.nativeElement.querySelector('.img-container-wrapper') as HTMLElement)?.offsetHeight || window.innerHeight),
        scrub: 0.5,
        anticipatePin: 1,
        // markers: true, // 可以開啟標記來調試
      }
    });

    // 內容區塊進入動畫
    const sections = gsap.utils.toArray('.more-content-inside-A') as HTMLElement[];
    sections.forEach((section) => {
      const animatedElements = section.querySelectorAll('.animated-content');
      gsap.fromTo(animatedElements,
        { autoAlpha: 0, y: 50, scale: 0.9 },
        {
          autoAlpha: 1, y: 0, scale: 1, duration: 1.2, ease: "power2.out", stagger: 0.2,
          scrollTrigger: {
            trigger: section,
            start: "top 75%", // 這裡當元素進入視口 75% 時觸發動畫
            toggleActions: "play none none none", // 啟動動畫但不重啟
            once: true, // 動畫只觸發一次
            markers: false, // 可以開啟來調試，但正式環境可以關閉
          }
        }
      );
    });
  }, this.bg1Ref.nativeElement);
}


  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    // 當元件被銷毀時 (例如導航到 /login)，清理所有動畫和 ScrollTrigger
    if (this.ctx) {
      this.ctx.revert();
    }
  }

}
