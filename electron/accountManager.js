'use strict';

/**
 * Account Manager — manages multiple Sound It accounts
 * Each account gets its own isolated Electron session partition
 * so cookies, localStorage and login state are fully separate.
 */

const { v4: uuid } = (() => {
  try { return require('crypto'); } catch (e) { return { v4: () => `${Date.now()}-${Math.random().toString(36).slice(2)}` }; }
})();

// Simple UUID fallback (no external dep needed)
function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

class AccountManager {
  constructor(store) {
    this.store = store;
    // Initialise with a default account on first run
    if (!this.store.has('accounts')) {
      const defaultId = makeId();
      this.store.set('accounts', [
        {
          id:        defaultId,
          name:      'Account 1',
          email:     null,
          avatar:    null,
          partition: `persist:soundit-${defaultId}`,
          addedAt:   Date.now(),
        },
      ]);
      this.store.set('activeAccountId', defaultId);
    }
  }

  // ── Getters ────────────────────────────────────────────────────────────────
  getAll() {
    return this.store.get('accounts', []);
  }

  getActive() {
    const id       = this.store.get('activeAccountId');
    const accounts = this.getAll();
    return accounts.find((a) => a.id === id) || accounts[0];
  }

  getById(id) {
    return this.getAll().find((a) => a.id === id);
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  addAccount() {
    const id      = makeId();
    const accounts = this.getAll();
    const newAcct  = {
      id,
      name:      `Account ${accounts.length + 1}`,
      email:     null,
      avatar:    null,
      partition: `persist:soundit-${id}`,
      addedAt:   Date.now(),
    };
    this.store.set('accounts', [...accounts, newAcct]);
    return newAcct;
  }

  setActive(id) {
    this.store.set('activeAccountId', id);
  }

  updateAccountInfo(id, { name, email, avatar }) {
    const accounts = this.getAll().map((a) =>
      a.id === id ? { ...a, name: name || a.name, email: email || a.email, avatar: avatar || a.avatar } : a
    );
    this.store.set('accounts', accounts);
  }

  removeAccount(id) {
    const accounts = this.getAll().filter((a) => a.id !== id);
    this.store.set('accounts', accounts);

    // If we removed the active account, switch to the first available
    if (this.store.get('activeAccountId') === id && accounts.length > 0) {
      this.store.set('activeAccountId', accounts[0].id);
    }
    return accounts;
  }
}

module.exports = AccountManager;
