;; Monitoring Contract
;; Tracks ongoing performance of carbon projects

(define-data-var last-report-id uint u0)

(define-map monitoring-reports
  { report-id: uint }
  {
    project-id: uint,
    period-start: uint,
    period-end: uint,
    carbon-reduction: uint,
    evidence-hash: (buff 32),
    verified: bool,
    verifier: (optional principal),
    submitted-by: principal,
    submitted-at: uint
  }
)

(define-map project-reports
  { project-id: uint }
  { report-ids: (list 20 uint) }
)

(define-map verifiers
  { address: principal }
  { active: bool }
)

(define-constant contract-owner tx-sender)

(define-public (submit-monitoring-report
    (project-id uint)
    (period-start uint)
    (period-end uint)
    (carbon-reduction uint)
    (evidence-hash (buff 32)))
  (let
    (
      (new-id (+ (var-get last-report-id) u1))
      (caller tx-sender)
      (project-reports-entry (default-to { report-ids: (list) } (map-get? project-reports { project-id: project-id })))
    )
    (asserts! (> period-end period-start) (err u1))
    (asserts! (< period-start block-height) (err u2))

    ;; Store the report
    (map-set monitoring-reports
      { report-id: new-id }
      {
        project-id: project-id,
        period-start: period-start,
        period-end: period-end,
        carbon-reduction: carbon-reduction,
        evidence-hash: evidence-hash,
        verified: false,
        verifier: none,
        submitted-by: caller,
        submitted-at: block-height
      }
    )

    ;; Update the project's report list
    (map-set project-reports
      { project-id: project-id }
      { report-ids: (unwrap! (as-max-len? (append (get report-ids project-reports-entry) new-id) u20) (err u3)) }
    )

    (var-set last-report-id new-id)
    (ok new-id)
  )
)

(define-public (add-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err u403))
    (map-set verifiers
      { address: verifier }
      { active: true }
    )
    (ok true)
  )
)

(define-public (verify-report (report-id uint))
  (let
    (
      (caller tx-sender)
      (report (unwrap! (map-get? monitoring-reports { report-id: report-id }) (err u404)))
      (is-verifier (default-to { active: false } (map-get? verifiers { address: caller })))
    )
    (asserts! (get active is-verifier) (err u403))
    (asserts! (not (get verified report)) (err u400))

    (map-set monitoring-reports
      { report-id: report-id }
      (merge report
        {
          verified: true,
          verifier: (some caller)
        }
      )
    )

    (ok true)
  )
)

(define-read-only (get-report (report-id uint))
  (map-get? monitoring-reports { report-id: report-id })
)

(define-read-only (get-project-reports (project-id uint))
  (get report-ids (default-to { report-ids: (list) } (map-get? project-reports { project-id: project-id })))
)
