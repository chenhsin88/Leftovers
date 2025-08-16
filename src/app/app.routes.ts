import { LoginComponent } from './login/login.component'; // Assuming login.component.ts is in src/app/login/
import { MainComponent } from './main/main.component';
import { FirstshowpageComponent } from './firstshowpage/firstshowpage.component';
import { Routes } from '@angular/router';
import { MerchantsComponent } from './merchants/merchants.component';
import { StoreManagementComponent } from './store-management/store-management.component';
import { ProductInventoryComponent } from './product-inventory/product-inventory.component';
import { OrderDetailComponent } from './order-detail/order-detail.component';
import { OrdersComponent } from './orders/orders.component';
import { RevenueComponent } from './revenue/revenue.component';
import { ReviewReplyComponent } from './review-reply/review-reply.component';
import { OrderHistoryComponent } from './order-history/order-history.component';
import { PushNotificationComponent } from './push-notification/push-notification.component';
import { MerchantRegistrationComponent } from './merchant-registration/merchant-registration.component';
import { StoreListComponent } from './store-list/store-list.component';
import { FaqComponent } from './faq/faq.component';
import { SignupComponent } from './signup/signup.component'; // Assuming singup.component.ts is in src/app/singup/
import { LocationComponent } from './location/location.component';
import { CartComponent } from './cart/cart.component';
import { PaymentResultComponent } from './payment-result/payment-result.component';
import { authGuard } from './@Services/auth.guard';
import { UserOrdersComponent } from './user-orders/user-orders.component';
import { MerchantDetailComponent } from './merchant-detail/merchant-detail.component';
import { locationGuard } from './@Services/location.guard';
import { loginGuard } from './@Services/login.guard';
import { ProfileEditComponent } from './profile-edit/profile-edit.component';
import { canDeactivateGuard } from './@Services/can-deactivate.guard';
import { roleGuard } from './@Services/role.guard';
import { hasStoresGuard } from './@Services/has-stores.guard';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';
import { DisclaimerComponent } from './disclaimer/disclaimer.component';
import { AboutUsComponent } from './about-us/about-us.component';

export const routes: Routes = [
  // ============== 公共路由 ==============
  { path: '', component: FirstshowpageComponent },
  { path: 'login', component: LoginComponent, canActivate: [loginGuard] },
  { path: 'firstshowpage', component: FirstshowpageComponent },
  { path: 'signup', component: SignupComponent, canActivate: [loginGuard], canDeactivate: [canDeactivateGuard] },

  { path: 'faq', component: FaqComponent },
  { path: 'paymentResult', component: PaymentResultComponent },
  { path: 'payment-result', component: PaymentResultComponent },
  { path: 'merchant/:id', component: MerchantDetailComponent }, // 這是給顧客看的店家詳情頁，保持公開

  // ============== 顧客 (customer) 專用路由 ==============
  {
    path: 'main',
    component: MainComponent,
    canActivate: [authGuard, locationGuard, roleGuard],
    data: { expectedRole: 'customer' }
  },
  {
    path: 'location',
    component: LocationComponent,
    canActivate: [authGuard, roleGuard],
    data: { expectedRole: 'customer' }
  },
  {
    path: 'userOrders/:userName',
    component: UserOrdersComponent,
    canActivate: [authGuard, roleGuard],
    data: { expectedRole: 'customer' }
  },
  {
    path: 'cart/:userName',
    component: CartComponent,
    canActivate: [authGuard, locationGuard, roleGuard],
    data: { expectedRole: 'customer' }
  },
  {
    path: 'profile-edit',
    component: ProfileEditComponent,
    canActivate: [authGuard],
    data: { expectedRole: 'customer' }
  },

  // ================ 商家 (merchants) 專用路由 ===============
  {
    path: 'merchantRegistration',
    component: MerchantRegistrationComponent,
    canActivate: [authGuard, roleGuard],
    data: { expectedRole: 'merchants' }
  },
  {
    path: 'storeList',
    component: StoreListComponent,
    canActivate: [authGuard, roleGuard, hasStoresGuard],
    data: { expectedRole: 'merchants' }
  },
  {
    path: 'merchants/:storeId',
    component: MerchantsComponent,


    canActivate: [authGuard, roleGuard, hasStoresGuard],
    canActivateChild: [authGuard, roleGuard, hasStoresGuard],
    data: { expectedRole: 'merchants' },
    children: [
      { path: 'pushNotification', component: PushNotificationComponent },
      { path: 'storeManagement', component: StoreManagementComponent },
      { path: 'productInventory', component: ProductInventoryComponent },
      { path: 'orders', component: OrdersComponent },
      { path: 'orderDetail/:orderNumber', component: OrderDetailComponent },
      { path: 'revenue', component: RevenueComponent },
      { path: 'reviewReply', component: ReviewReplyComponent },
      { path: 'orderHistory', component: OrderHistoryComponent },

    ]
  },

  // ================ Footer路由 ===============
  { path: 'privacyPolicy', component: PrivacyPolicyComponent },
  { path: 'disclaimer', component: DisclaimerComponent },
  { path: 'aboutUs', component: AboutUsComponent },

];
