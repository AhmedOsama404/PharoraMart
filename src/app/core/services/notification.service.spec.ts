import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { NotificationService } from './notification.service';

describe('NotificationService (dedup policy)', () => {
  let svc: NotificationService;
  let messages: MessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MessageService] });
    svc = TestBed.inject(NotificationService);
    messages = TestBed.inject(MessageService);
    spyOn(messages, 'add').and.callThrough();
  });

  it('collapses identical rapid repeats into one toast', fakeAsync(() => {
    svc.success('notifications.addedToCart');
    svc.success('notifications.addedToCart');
    svc.success('notifications.addedToCart');
    tick(100);
    expect(messages.add).toHaveBeenCalledTimes(1);
  }));

  it('allows the same message again after the window expires', fakeAsync(() => {
    svc.success('notifications.addedToCart');
    tick(1500);
    svc.success('notifications.addedToCart');
    expect(messages.add).toHaveBeenCalledTimes(2);
  }));

  it('never drops distinct messages, including errors', fakeAsync(() => {
    svc.success('notifications.addedToCart');
    svc.error('notifications.loadFailed');
    svc.info('cart.cartCleared');
    expect(messages.add).toHaveBeenCalledTimes(3);
  }));

  it('dedups identical errors too, without hiding the first one', fakeAsync(() => {
    svc.error('notifications.loadFailed');
    svc.error('notifications.loadFailed');
    expect(messages.add).toHaveBeenCalledTimes(1);
  }));

  it('clear() resets the dedup memory', fakeAsync(() => {
    svc.success('notifications.addedToCart');
    svc.clear();
    svc.success('notifications.addedToCart');
    expect(messages.add).toHaveBeenCalledTimes(2);
  }));
});
