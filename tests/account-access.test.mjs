import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountForReview,
  canManageOwnerPortal,
  isConfiguredOwnerEmail,
  isVerifiedConfiguredOwner,
  normalizeReviewDecision,
  resolveAccountRole
} from '../api/_lib/account-access.ts';

test('a registered auth user without a profile appears pending with standard access', () => {
  const account = accountForReview({
    id: 'auth-user-1',
    email: 'New.Student@example.com',
    name: 'New Student',
    createdAt: '2026-10-28T10:00:00.000Z'
  });

  assert.equal(account.auth_id, 'auth-user-1');
  assert.equal(account.email, 'new.student@example.com');
  assert.equal(account.display_name, 'New Student');
  assert.equal(account.approval_status, 'pending');
  assert.equal(account.role, 'student');
});

test('owner recognition requires a normalized match to the configured server email', () => {
  assert.equal(isConfiguredOwnerEmail(' OWNER@example.com ', 'owner@example.com'), true);
  assert.equal(isConfiguredOwnerEmail('owner@example.com', ''), false);
  assert.equal(isConfiguredOwnerEmail('other@example.com', 'owner@example.com'), false);
});

test('owner recognition requires a verified Neon Auth email', () => {
  assert.equal(isVerifiedConfiguredOwner('owner@example.com', true, 'owner@example.com'), true);
  assert.equal(isVerifiedConfiguredOwner('owner@example.com', false, 'owner@example.com'), false);
  assert.equal(isVerifiedConfiguredOwner('owner@example.com', null, 'owner@example.com'), false);
});

test('owner portal authorization requires the configured identity and approved owner profile', () => {
  const configuredOwner = {
    identityEmail: 'owner@example.com',
    emailVerified: true,
    configuredOwnerEmail: 'owner@example.com',
    profileRole: 'owner',
    approvalStatus: 'approved'
  };

  assert.equal(canManageOwnerPortal(configuredOwner), true);
  assert.equal(canManageOwnerPortal({ ...configuredOwner, identityEmail: 'student@example.com' }), false);
  assert.equal(canManageOwnerPortal({ ...configuredOwner, emailVerified: false }), false);
  assert.equal(canManageOwnerPortal({ ...configuredOwner, configuredOwnerEmail: '' }), false);
  assert.equal(canManageOwnerPortal({ ...configuredOwner, approvalStatus: 'pending' }), false);
  assert.equal(canManageOwnerPortal({ ...configuredOwner, profileRole: 'tutor' }), false);
});

test('approved access survives a later sign-in because role resolution reads the persisted profile', () => {
  const storedProfile = { role: 'tutor', approvalStatus: 'approved' };
  const firstSignIn = resolveAccountRole({
    identityEmail: 'user@example.com',
    emailVerified: true,
    configuredOwnerEmail: 'owner@example.com',
    storedRole: storedProfile.role,
    approvalStatus: storedProfile.approvalStatus
  });
  const nextSignIn = resolveAccountRole({
    identityEmail: 'user@example.com',
    emailVerified: true,
    configuredOwnerEmail: 'owner@example.com',
    storedRole: storedProfile.role,
    approvalStatus: storedProfile.approvalStatus
  });

  assert.equal(firstSignIn, 'tutor');
  assert.equal(nextSignIn, 'tutor');
});

test('declined accounts keep the standard experience and cannot use the upgraded role', () => {
  assert.equal(resolveAccountRole({
    identityEmail: 'user@example.com',
    emailVerified: true,
    configuredOwnerEmail: 'owner@example.com',
    storedRole: 'tutor',
    approvalStatus: 'rejected'
  }), 'student');
});

test('review decisions support approval and decline but never assign owner access', () => {
  assert.deepEqual(normalizeReviewDecision({
    targetEmail: 'learner@example.com',
    configuredOwnerEmail: 'owner@example.com',
    status: 'approved',
    role: 'tutor'
  }), { status: 'approved', role: 'tutor' });
  assert.deepEqual(normalizeReviewDecision({
    targetEmail: 'learner@example.com',
    configuredOwnerEmail: 'owner@example.com',
    status: 'rejected',
    role: 'student'
  }), { status: 'rejected', role: 'student' });
  assert.equal(normalizeReviewDecision({
    targetEmail: 'owner@example.com',
    configuredOwnerEmail: 'owner@example.com',
    status: 'approved',
    role: 'tutor'
  }), null);
  assert.equal(normalizeReviewDecision({
    targetEmail: 'learner@example.com',
    configuredOwnerEmail: 'owner@example.com',
    status: 'approved',
    role: 'owner'
  }), null);
});
