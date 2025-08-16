import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FirstshowpageComponent } from './firstshowpage.component';

describe('FirstshowpageComponent', () => {
  let component: FirstshowpageComponent;
  let fixture: ComponentFixture<FirstshowpageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FirstshowpageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FirstshowpageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
