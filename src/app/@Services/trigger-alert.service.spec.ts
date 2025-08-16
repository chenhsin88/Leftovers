import { TestBed } from '@angular/core/testing';

import { TriggerAlertService } from './trigger-alert.service';

describe('TriggerAlertService', () => {
  let service: TriggerAlertService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TriggerAlertService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
