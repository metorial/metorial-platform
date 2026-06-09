import { describe, expect, it } from 'vitest';
import { normalizeEmail } from './normalizeEmail';

describe('normalizeEmail', () => {
  it('should normalize a lowercase email with no dots or plus signs', () => {
    const email = 'test@example.com';
    const normalizedEmail = normalizeEmail(email);
    expect(normalizedEmail).toBe('test@example.com');
  });

  it('should not normalize a lowercase email with dots', () => {
    const email = 'test.first.last@example.com';
    const normalizedEmail = normalizeEmail(email);
    expect(normalizedEmail).toBe('test.first.last@example.com');
  });

  it('should normalize a lowercase email with plus sign', () => {
    const email = 'test+extra@example.com';
    const normalizedEmail = normalizeEmail(email);
    expect(normalizedEmail).toBe('test@example.com');
  });

  it('should normalize a lowercase email with googlemail.com domain', () => {
    const email = 'test@googlemail.com';
    const normalizedEmail = normalizeEmail(email);
    expect(normalizedEmail).toBe('test@gmail.com');
  });

  it('should normalize a lowercase email with gmail.com domain', () => {
    const email = 'test.first.last@gmail.com';
    const normalizedEmail = normalizeEmail(email);
    expect(normalizedEmail).toBe('testfirstlast@gmail.com');
  });

  it('should normalize an uppercase email with no dots or plus signs', () => {
    const email = 'TEST@gMail.COM';
    const normalizedEmail = normalizeEmail(email);
    expect(normalizedEmail).toBe('test@gmail.com');
  });
});
