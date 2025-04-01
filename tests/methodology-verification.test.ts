import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity VM environment
const mockClarity = {
  blockHeight: 100,
  txSender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  contracts: {
    methodologyVerification: {
      lastMethodologyId: 0,
      methodologies: new Map(),
      verifiers: new Map(),
      contractOwner: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      
      registerMethodology(name, description, verificationStandard) {
        const newId = this.lastMethodologyId + 1;
        const caller = mockClarity.txSender;
        
        this.methodologies.set(newId, {
          name,
          description,
          'verification-standard': verificationStandard,
          creator: caller,
          verified: false,
          verifier: null,
          'created-at': mockClarity.blockHeight
        });
        
        this.lastMethodologyId = newId;
        return { ok: newId };
      },
      
      addVerifier(verifier) {
        if (mockClarity.txSender !== this.contractOwner) {
          return { err: 403 };
        }
        
        this.verifiers.set(verifier, { active: true });
        return { ok: true };
      },
      
      verifyMethodology(methodologyId) {
        const caller = mockClarity.txSender;
        const methodology = this.methodologies.get(methodologyId);
        
        if (!methodology) {
          return { err: 404 };
        }
        
        const isVerifier = this.verifiers.get(caller);
        if (!isVerifier || !isVerifier.active) {
          return { err: 403 };
        }
        
        if (methodology.verified) {
          return { err: 400 };
        }
        
        methodology.verified = true;
        methodology.verifier = caller;
        this.methodologies.set(methodologyId, methodology);
        
        return { ok: true };
      },
      
      getMethodology(methodologyId) {
        return this.methodologies.get(methodologyId) || null;
      },
      
      isMethodologyVerified(methodologyId) {
        const methodology = this.methodologies.get(methodologyId);
        return methodology ? methodology.verified : false;
      }
    }
  }
};

// Set up global mock
vi.mock('clarity-vm', () => mockClarity, { virtual: true });

describe('Methodology Verification Contract', () => {
  beforeEach(() => {
    // Reset state before each test
    mockClarity.blockHeight = 100;
    mockClarity.contracts.methodologyVerification.lastMethodologyId = 0;
    mockClarity.contracts.methodologyVerification.methodologies = new Map();
    mockClarity.contracts.methodologyVerification.verifiers = new Map();
  });
  
  it('should register a new methodology successfully', () => {
    const contract = mockClarity.contracts.methodologyVerification;
    const result = contract.registerMethodology(
        'Improved Forest Management',
        'A methodology for quantifying GHG emission removals from improved forest management',
        'Verra VCS'
    );
    
    expect(result).toEqual({ ok: 1 });
    expect(contract.lastMethodologyId).toBe(1);
    
    const methodology = contract.getMethodology(1);
    expect(methodology).not.toBeNull();
    expect(methodology.name).toBe('Improved Forest Management');
    expect(methodology.verified).toBe(false);
  });
  
  it('should add a verifier if contract owner', () => {
    const contract = mockClarity.contracts.methodologyVerification;
    const verifierAddress = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    const result = contract.addVerifier(verifierAddress);
    expect(result).toEqual({ ok: true });
    
    const verifier = contract.verifiers.get(verifierAddress);
    expect(verifier).toEqual({ active: true });
  });
  
  it('should fail to add verifier if not contract owner', () => {
    const contract = mockClarity.contracts.methodologyVerification;
    const verifierAddress = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    // Change sender
    const originalSender = mockClarity.txSender;
    mockClarity.txSender = 'ST3CECAKJ4BH08JYY7W53MC81BYDT4YDA5Z7GZQYV';
    
    const result = contract.addVerifier(verifierAddress);
    expect(result).toEqual({ err: 403 });
    
    // Restore sender
    mockClarity.txSender = originalSender;
  });
  
  it('should verify a methodology if authorized verifier', () => {
    const contract = mockClarity.contracts.methodologyVerification;
    const verifierAddress = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    // Register methodology
    contract.registerMethodology(
        'Test Methodology',
        'Description',
        'Standard'
    );
    
    // Add verifier
    contract.addVerifier(verifierAddress);
    
    // Change sender to verifier
    mockClarity.txSender = verifierAddress;
    
    // Verify methodology
    const result = contract.verifyMethodology(1);
    expect(result).toEqual({ ok: true });
    
    // Check if verified
    const methodology = contract.getMethodology(1);
    expect(methodology.verified).toBe(true);
    expect(methodology.verifier).toBe(verifierAddress);
  });
  
  it('should fail to verify if not an authorized verifier', () => {
    const contract = mockClarity.contracts.methodologyVerification;
    
    // Register methodology
    contract.registerMethodology(
        'Test Methodology',
        'Description',
        'Standard'
    );
    
    // Change sender to unauthorized address
    mockClarity.txSender = 'ST3CECAKJ4BH08JYY7W53MC81BYDT4YDA5Z7GZQYV';
    
    // Try to verify methodology
    const result = contract.verifyMethodology(1);
    expect(result).toEqual({ err: 403 });
  });
});
