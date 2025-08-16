import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CartoMapComponent } from './carto-map.component';

describe('CartoMapComponent', () => {
  let component: CartoMapComponent;
  let fixture: ComponentFixture<CartoMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartoMapComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CartoMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
