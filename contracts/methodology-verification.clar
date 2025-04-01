;; Methodology Verification Contract
;; Validates calculation approaches for carbon reduction

(define-data-var last-methodology-id uint u0)

(define-map methodologies
  { methodology-id: uint }
  {
    name: (string-utf8 100),
    description: (string-utf8 500),
    verification-standard: (string-utf8 100),
    creator: principal,
    verified: bool,
    verifier: (optional principal),
    created-at: uint
  }
)

(define-map verifiers
  { address: principal }
  { active: bool }
)

(define-constant contract-owner tx-sender)

(define-public (register-methodology
    (name (string-utf8 100))
    (description (string-utf8 500))
    (verification-standard (string-utf8 100)))
  (let
    (
      (new-id (+ (var-get last-methodology-id) u1))
      (caller tx-sender)
    )
    (map-set methodologies
      { methodology-id: new-id }
      {
        name: name,
        description: description,
        verification-standard: verification-standard,
        creator: caller,
        verified: false,
        verifier: none,
        created-at: block-height
      }
    )

    (var-set last-methodology-id new-id)
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

(define-public (verify-methodology (methodology-id uint))
  (let
    (
      (caller tx-sender)
      (methodology (unwrap! (map-get? methodologies { methodology-id: methodology-id }) (err u404)))
      (is-verifier (default-to { active: false } (map-get? verifiers { address: caller })))
    )
    (asserts! (get active is-verifier) (err u403))
    (asserts! (not (get verified methodology)) (err u400))

    (map-set methodologies
      { methodology-id: methodology-id }
      (merge methodology
        {
          verified: true,
          verifier: (some caller)
        }
      )
    )

    (ok true)
  )
)

(define-read-only (get-methodology (methodology-id uint))
  (map-get? methodologies { methodology-id: methodology-id })
)

(define-read-only (is-methodology-verified (methodology-id uint))
  (default-to false (get verified (map-get? methodologies { methodology-id: methodology-id })))
)
