// in: src/app/@Services/can-deactivate.guard.ts

import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

/**
 * 定義一個介面，任何想要使用此守衛的元件都必須實作這個介面。
 * 這確保了元件一定會有一個名為 canDeactivate 的方法可供守衛呼叫。
 */
export interface CanComponentDeactivate {
  canDeactivate: () => Observable<boolean> | Promise<boolean> | boolean;
}

/**
 * 這是一個可重用的 CanDeactivate 守衛。
 * 它會檢查目標元件是否實作了 CanComponentDeactivate 介面。
 * 如果有，它就會呼叫該元件的 canDeactivate() 方法來決定是否允許離開。
 */
export const canDeactivateGuard: CanDeactivateFn<CanComponentDeactivate> = (
  component: CanComponentDeactivate
) => {
  // 如果元件存在且實作了 canDeactivate 方法，就呼叫它。
  // 否則，如果元件沒有這個方法，就直接允許離開 (回傳 true)。
  return component.canDeactivate ? component.canDeactivate() : true;
};
