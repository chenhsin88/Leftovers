import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon'; // **新增：為了使用 mat-icon**
import { UsersServicesService, UserVo, UserUpdateReq } from '../@Services/users-services.service';
import { first, Subscription } from 'rxjs';
import { TriggerAlertService } from '../@Services/trigger-alert.service';

// 自訂驗證器：檢查兩個密碼欄位是否匹配
export function passwordMatchValidator(controlName: string, matchingControlName: string) {
  return (formGroup: AbstractControl): ValidationErrors | null => {
    const control = formGroup.get(controlName);
    const matchingControl = formGroup.get(matchingControlName);

    if (matchingControl?.errors && !matchingControl.errors['passwordMismatch']) {
      return null;
    }

    if (control?.value !== matchingControl?.value) {
      matchingControl?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
      matchingControl?.setErrors(null);
      return null;
    }
  };
}

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule
  ],
  templateUrl: './profile-edit.component.html',
})
export class ProfileEditComponent implements OnInit, OnDestroy {
  // 注入服務
  private fb = inject(FormBuilder);
  private usersService = inject(UsersServicesService);
  private router = inject(Router);
  private subscriptions = new Subscription();
  private triggerAlertService = inject(TriggerAlertService);

  // 元件狀態
  currentUser: UserVo | null = null;
  profileForm!: FormGroup;
  isSaving = false;
  avatarPreview: string | null = null;
  avatarChanged = false;

  // 密碼可見性狀態
  passwordVisibility = {
    current: false,
    new: false,
    confirm: false
  };

  ngOnInit(): void {
    this.initializeForm();
    this.loadUserData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get isSaveDisabled(): boolean {
    // 情況一：如果只有頭像變更，但表單欄位未被更動 (pristine)
    // 這種情況下，無論表單初始是否有效，都應該允許儲存。
    if (this.avatarChanged && this.profileForm.pristine) {
      return false; // 直接回傳 false (啟用按鈕)
    }

    // 情況二：如果表單欄位有被更動，或頭像未變更
    // 則回歸原本的判斷標準：儲存中、表單無效、或表單未被更動時，禁用按鈕。
    return this.isSaving || this.profileForm.invalid || this.profileForm.pristine;
  }


  private initializeForm(): void {
    this.profileForm = this.fb.group({
      email: [{ value: '', disabled: true }],
      name: ['', [Validators.required, Validators.minLength(1)]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^09\d{8}$/)]],
      currentPassword: [''],
      newPassword: ['', [Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,16}$/)]],
      confirmPassword: ['']
    }, {
      validators: passwordMatchValidator('newPassword', 'confirmPassword')
    });

    const newPasswordControl = this.profileForm.get('newPassword');
    const currentPasswordControl = this.profileForm.get('currentPassword');
    const confirmPasswordControl = this.profileForm.get('confirmPassword');

    if (newPasswordControl && currentPasswordControl && confirmPasswordControl) {
    // 【邏輯一】新密碼驅動目前密碼
    const sub1 = newPasswordControl.valueChanges.subscribe(value => {
      if (value) {
        currentPasswordControl.setValidators([Validators.required]);
      } else if (!currentPasswordControl.value) {
        currentPasswordControl.clearValidators();
      }
      // 👇 **修正點**：新增 { emitEvent: false }
      currentPasswordControl.updateValueAndValidity({ emitEvent: false });
    });

    // 【邏輯二】目前密碼驅動新密碼和確認密碼
    const sub2 = currentPasswordControl.valueChanges.subscribe(value => {
      if (value) {
        newPasswordControl.setValidators([
            Validators.required,
            Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,16}$/)
        ]);
        confirmPasswordControl.setValidators([Validators.required]);
      } else if (!newPasswordControl.value) {
        newPasswordControl.setValidators([Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,16}$/)]);
        confirmPasswordControl.clearValidators();
      }
      // 👇 **修正點**：新增 { emitEvent: false }
      newPasswordControl.updateValueAndValidity({ emitEvent: false });
      confirmPasswordControl.updateValueAndValidity({ emitEvent: false });
    });

    this.subscriptions.add(sub1);
    this.subscriptions.add(sub2);
  }
  }

  private loadUserData(): void {
    const sub = this.usersService.currentUser$.pipe(
      first(user => user !== null)
    ).subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.profileForm.patchValue({
          email: user.email,
          name: user.name,
          phoneNumber: user.phoneNumber
        });
        this.avatarPreview = user.profilePictureUrl;
      }
    });
    this.subscriptions.add(sub);
  }

  get f() { return this.profileForm.controls; }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        this.triggerAlertService.trigger('檔案大小不能超過 5MB', 'error');
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        this.triggerAlertService.trigger('只接受 .jpg, .png, .webp 格式的圖片', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview = reader.result as string;
        this.avatarChanged = true;
      };
      reader.readAsDataURL(file);
      input.value = '';
    }
  }

  removeAvatar(): void {
    if (this.currentUser) {
      this.avatarPreview = this.currentUser.profilePictureUrl;
      this.avatarChanged = false;
    } else {
      this.avatarPreview = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjMWYxZjFmIj48cGF0aCBkPSJNMjM0LTI3NnE1MS0zOSAxMTQtNjEuNVQ0ODAtMzYwcTY5IDAgMTMyIDIyLjVUNzI2LTI3NnEzNS00MSA1NC41LTkzVDgwMC00ODBxMC0xMzMtOTMuNS0yMjYuNVQ0ODAtODAwcS0xMzMgMC0yMjYuNSA5My41VDE2MC00ODBxMCA1OSAxOS41IDExMXQ1NC41IDkzWm0yNDYtMTY0cS01OSAwLTk5LjUtNDAuNVQzNDAtNTgwcTAtNTkgNDAuNS05OS41VDQ4MC03MjBxNTkgMCA5OS41IDQwLjVUNjIwLTU4MHEwIDU5LTQwLjUgOTkuNVQ0ODAtNDQwWm0wIDM2MHEtODMgMC0xNTYtMzEuNVQxOTctMTk3cS01NC01NC04NS41LTEyN1Q4MC00ODBxMC04MyAzMS41LTE1NlQxOTctNzYzcTU0LTU0IDEyNy04NS41VDQ4MC04ODBxODMgMCAxNTYgMzEuNVQ3NjMtNzYzcTU0IDU0IDg1LjUgMTI3VDg4MC00ODBxMCA4My0zMS41IDE1NlQ3NjMtMTk3cS01NCA1NC0xMjcgODUuNVQ0ODAtODBabTAtODBxNTMgMCAxMDAtMTUuNXQ4Ni00NC41cS0zOS0yOS04Ni00NC41VDQ4MC0yODBxLTUzIDAtMTAwIDE1LjVUMjk0LTIyMHEzOSAyOSA4NiA0NC41VDQ4MC0xNjBabTAtMzYwcTI2IDAgNDMtMTd0MTctNDNxMC0yNi0xNy00M3QtNDMtMTdxLTI2IDAtNDMgMTd0LTE3IDQzcTAgMjYgMTcgNDN0NDMgMTdabTAtNjBabTAgMzYwWiIvPjwvc3ZnPg==';
    }
  }

  togglePasswordVisibility(field: 'current' | 'new' | 'confirm'): void {
    this.passwordVisibility[field] = !this.passwordVisibility[field];
  }

  onCancel(): void {
    // this.router.navigate(['/main']);
    if (this.currentUser?.role === 'customer') {
      this.router.navigate(['/main']);
    } else if (this.currentUser?.role === 'merchants') {
      this.router.navigate(['/storeList']);
    } else {
      // 如果身分不符合，可以設定一個預設的導向路徑
      this.router.navigate(['/login']);
    }
  }

  onSubmit(): void {
    const isFormInvalidAndDirty = this.profileForm.invalid && this.profileForm.dirty;

    if (isFormInvalidAndDirty) {
      this.profileForm.markAllAsTouched();
      this.triggerAlertService.trigger('請檢查表單內容是否正確', 'warning');
      return;
    }

    if (!this.currentUser) return;

    this.isSaving = true;

    const formValue = this.profileForm.getRawValue();
    const updatePayload: UserUpdateReq = {
      email: this.currentUser.email,
    };

    if (this.profileForm.dirty) {
      updatePayload.name = formValue.name;
      updatePayload.phoneNumber = formValue.phoneNumber;
    }

    // 【修改】當使用者要變更密碼時
    if (formValue.newPassword) {
      updatePayload.passwordHash = formValue.newPassword;
      // 【新增】同時將 "目前密碼" 也加入到請求中
      updatePayload.currentPassword = formValue.currentPassword;
    }

    if (this.avatarChanged) {
      updatePayload.profilePictureUrl = this.avatarPreview || '';
    }

    this.usersService.updateUser(updatePayload).subscribe({
      next: (res) => {
        // 【修改】後端現在可能會回傳密碼錯誤的訊息，我們直接顯示它
        if (res.code === 200) {
          window.scrollTo(0, 0);

          // 【新增】根據使用者身分進行路由導向
          if (this.usersService.currentUserValue?.role === 'customer') {
            this.router.navigate(['/main']);
          } else if (this.usersService.currentUserValue?.role === 'merchants') {
            this.router.navigate(['/storeList']);
          } else {
            // 如果身分不符合，可以設定一個預設的導向路徑
            this.router.navigate(['/login']);
          }

        } else {
          // 如果 code 不是 200，也顯示後端回傳的訊息 (例如：目前密碼不正確)
          this.triggerAlertService.trigger(res.message, 'error');
        }
        this.isSaving = false;
      },
      error: (err) => {
        // 當 updateUser 服務發生 HTTP 錯誤時，顯示錯誤訊息
        this.triggerAlertService.trigger(err.error?.message || '更新時發生未知錯誤', 'error');
        this.isSaving = false;
      }
    });
  }
}
