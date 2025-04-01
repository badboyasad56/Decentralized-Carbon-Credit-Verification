import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock the Clarity VM environment
const mockClarity = {
  blockHeight: 100,
  txSender: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  contracts: {
    monitoring: {
      lastReportId: 0,
      monitoringReports: new Map(),
      projectReports: new Map(),
      verifiers: new Map(),
      contractOwner: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      
      submitMonitoringReport(projectId, periodStart, periodEnd, carbonReduction, evidenceHash) {
        // Validate inputs
        if (periodEnd <= periodStart) {
          return { err: 1 }
        }
        if (periodStart >= mockClarity.blockHeight) {
          return { err: 2 }
        }
        
        const newId = this.lastReportId + 1
        const caller = mockClarity.txSender
        
        // Get existing project reports
        const projectReportsEntry = this.projectReports.get(projectId) || { reportIds: [] }
        
        // Check if we can add more reports
        if (projectReportsEntry.reportIds.length >= 20) {
          return { err: 3 }
        }
        
        // Store the report
        this.monitoringReports.set(newId, {
          "project-id": projectId,
          "period-start": periodStart,
          "period-end": periodEnd,
          "carbon-reduction": carbonReduction,
          "evidence-hash": evidenceHash,
          verified: false,
          verifier: null,
          "submitted-by": caller,
          "submitted-at": mockClarity.blockHeight,
        })
        
        // Update project reports
        projectReportsEntry.reportIds.push(newId)
        this.projectReports.set(projectId, projectReportsEntry)
        
        this.lastReportId = newId
        return { ok: newId }
      },
      
      addVerifier(verifier) {
        if (mockClarity.txSender !== this.contractOwner) {
          return { err: 403 }
        }
        
        this.verifiers.set(verifier, { active: true })
        return { ok: true }
      },
      
      verifyReport(reportId) {
        const caller = mockClarity.txSender
        const report = this.monitoringReports.get(reportId)
        
        if (!report) {
          return { err: 404 }
        }
        
        const isVerifier = this.verifiers.get(caller)
        if (!isVerifier || !isVerifier.active) {
          return { err: 403 }
        }
        
        if (report.verified) {
          return { err: 400 }
        }
        
        report.verified = true
        report.verifier = caller
        this.monitoringReports.set(reportId, report)
        
        return { ok: true }
      },
      
      getReport(reportId) {
        return this.monitoringReports.get(reportId) || null
      },
      
      getProjectReports(projectId) {
        const projectReportsEntry = this.projectReports.get(projectId)
        return projectReportsEntry ? projectReportsEntry.reportIds : []
      },
    },
  },
}

// Set up global mock
vi.mock("clarity-vm", () => mockClarity, { virtual: true })

describe("Monitoring Contract", () => {
  beforeEach(() => {
    // Reset state before each test
    mockClarity.blockHeight = 100
    mockClarity.contracts.monitoring.lastReportId = 0
    mockClarity.contracts.monitoring.monitoringReports = new Map()
    mockClarity.contracts.monitoring.projectReports = new Map()
    mockClarity.contracts.monitoring.verifiers = new Map()
  })
  
  it("should submit a monitoring report successfully", () => {
    const contract = mockClarity.contracts.monitoring
    const result = contract.submitMonitoringReport(
        1, // project ID
        50, // period start (in the past)
        150, // period end (in the future)
        1000, // carbon reduction in tons
        Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex"),
    )
    
    expect(result).toEqual({ ok: 1 })
    expect(contract.lastReportId).toBe(1)
    
    const report = contract.getReport(1)
    expect(report).not.toBeNull()
    expect(report["project-id"]).toBe(1)
    expect(report["carbon-reduction"]).toBe(1000)
    expect(report.verified).toBe(false)
  })
  
  it("should fail if period end is before period start", () => {
    const contract = mockClarity.contracts.monitoring
    const result = contract.submitMonitoringReport(
        1, // project ID
        80, // period start
        50, // period end before start
        1000, // carbon reduction
        Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex"),
    )
    
    expect(result).toEqual({ err: 1 })
    expect(contract.lastReportId).toBe(0)
  })
  
  it("should fail if period start is in the future", () => {
    const contract = mockClarity.contracts.monitoring
    const result = contract.submitMonitoringReport(
        1, // project ID
        150, // period start in the future
        200, // period end
        1000, // carbon reduction
        Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex"),
    )
    
    expect(result).toEqual({ err: 2 })
    expect(contract.lastReportId).toBe(0)
  })
  
  it("should add a verifier if contract owner", () => {
    const contract = mockClarity.contracts.monitoring
    const verifierAddress = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
    
    const result = contract.addVerifier(verifierAddress)
    expect(result).toEqual({ ok: true })
    
    const verifier = contract.verifiers.get(verifierAddress)
    expect(verifier).toEqual({ active: true })
  })
  
  it("should verify a report if authorized verifier", () => {
    const contract = mockClarity.contracts.monitoring
    const verifierAddress = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
    
    // Submit a report
    contract.submitMonitoringReport(
        1, // project ID
        50, // period start
        150, // period end
        1000, // carbon reduction
        Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex"),
    )
    
    // Add verifier
    contract.addVerifier(verifierAddress)
    
    // Change sender to verifier
    mockClarity.txSender = verifierAddress
    
    // Verify report
    const result = contract.verifyReport(1)
    expect(result).toEqual({ ok: true })
    
    // Check if verified
    const report = contract.getReport(1)
    expect(report.verified).toBe(true)
    expect(report.verifier).toBe(verifierAddress)
  })
})

