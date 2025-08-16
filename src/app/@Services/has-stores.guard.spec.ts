import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { hasStoresGuard } from './has-stores.guard';

describe('hasStoresGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => hasStoresGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
