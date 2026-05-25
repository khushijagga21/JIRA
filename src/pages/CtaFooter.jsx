import workSphereLogo from '../assets/worksphere-logo.png'

export default function CtaFooter() {
  return (
    <>
      <section className="cta" id="tour-cta">
        <div className="container cta-inner">
          <h2 className="cta-title">Help your team collaborate with confidence</h2>
          <p className="cta-desc">
            Bring conversations, priorities, and delivery into one calm workspace—so everyone stays
            aligned from first idea to final release.
          </p>
          <a className="btn btn-amber" href="#">
            Get it free
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-brand" aria-hidden="true">
            <span className="footer-mark">
              <img className="footer-logo" src={workSphereLogo} alt="" />
            </span>
          </div>

          <div className="footer-cols">
            <div className="footer-col">
              <div className="footer-title">Company</div>
              <a className="footer-link" href="#">Careers</a>
              <a className="footer-link" href="#">Events</a>
              <a className="footer-link" href="#">Blogs</a>
              <a className="footer-link" href="#">Investor Relations</a>
            </div>
            <div className="footer-col">
              <div className="footer-title">Products</div>
              <a className="footer-link" href="#">Rovo</a>
              <a className="footer-link" href="#">workSphere</a>
              <a className="footer-link" href="#">Confluence</a>
              <a className="footer-link" href="#">Bitbucket</a>
            </div>
            <div className="footer-col">
              <div className="footer-title">Resources</div>
              <a className="footer-link" href="#">Technical support</a>
              <a className="footer-link" href="#">Purchasing & licensing</a>
              <a className="footer-link" href="#">workSphere Community</a>
              <a className="footer-link" href="#">My account</a>
            </div>
            <div className="footer-col">
              <div className="footer-title">Learn</div>
              <a className="footer-link" href="#">Partners</a>
              <a className="footer-link" href="#">Training & certification</a>
              <a className="footer-link" href="#">Documentation</a>
              <a className="footer-link" href="#">Developer resources</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

