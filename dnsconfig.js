/** @type {ISubDomain[]} */
var subDomains = []

var validate = new function () {
  this.domain = function (domain) {
    return typeof domain === 'string' && (domain === '1bt.uk' || domain === 'is-an.app')
  }

  this.description = function (description) {
    return typeof description === 'string' && description.length > 4
  }

  this.subDomain = function (subDomain) {
    if (typeof subDomain !== 'string') return false
    if (subDomain.length < 2 && subDomain !== '@') return false
    if (subDomain.length > 63) return false
    return /([a-zA-Z0-9_*.-]{2,64}|@)$/.test(subDomain)
  }

  this.txt = function (txt) {
    return typeof txt === 'string' && (txt.length > 0 && txt.length <= 255)
  }

  this.a = function (a) {
    return typeof a === 'string' && /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/.test(a)
  }

  this.aaaa = function (aaaa) {
    return typeof aaaa === 'string' && /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/.test(aaaa)
  }

  this.cname = function (cname) {
    return typeof cname === 'string' && /^[a-zA-Z0-9_./-]{2,}$/.test(cname)
  }

  this.ns = function (ns) {
    return typeof ns === 'string' && /^[a-zA-Z0-9._-]{3,}$/.test(ns)
  }
}

function addSubDomain(data) {
  if (typeof data !== 'object') throw new Error('Invalid subdomain data (must be an object)')

  if (!validate.domain(data.domain)) throw new Error('Invalid domain name: "' + data.domain + '"')
  if (!validate.description(data.description)) throw new Error('Invalid subdomain description: "' + data.description + '"')
  if (!validate.subDomain(data.subdomain)) throw new Error('Invalid subdomain name: "' + data.subdomain + '"')

  data.subdomain = data.subdomain.toLowerCase().trim()

  var subdomainsBlacklist = [ /* List of blacklisted subdomains */ ]

  if (subdomainsBlacklist.includes(data.subdomain)) throw new Error('Denied subdomain name: "' + data.subdomain + '"')

  if (typeof data.owner === 'object') {
    if (data.owner.repo !== undefined && typeof data.owner.repo !== 'string') throw new Error('Invalid owner repo property (must be a string)')
    if (data.owner.email !== undefined && typeof data.owner.email !== 'string') throw new Error('Invalid owner email property (must be a string)')
  }

  if (typeof data.proxy !== 'boolean') data.proxy = true

  if (typeof data.record !== 'object') throw new Error('Invalid subdomain "record" property (must be an object)')
  else {
    if (Array.isArray(data.record.TXT) && !data.record.TXT.every(validate.txt)) throw new Error('TXT records must be an array of non-empty strings')
    if (Array.isArray(data.record.A) && !data.record.A.every(validate.a)) throw new Error('A records must be an array of valid IPv4 addresses')
    if (Array.isArray(data.record.AAAA) && !data.record.AAAA.every(validate.aaaa)) throw new Error('AAAA records must be an array of valid IPv6 addresses')
    if (typeof data.record.CNAME === 'string' && !validate.cname(data.record.CNAME)) throw new Error('Invalid CNAME record: "' + data.record.CNAME + '"')
    if (typeof data.record.CNAME === 'string') data.record.CNAME = data.record.CNAME.toLowerCase().replace(/\.+$/, '') + '.'
    if (Array.isArray(data.record.NS)) {
      if (data.record.A || data.record.AAAA || data.record.CNAME) throw new Error('NS records cannot be used with A, AAAA or CNAME records')
      if (!data.record.NS.every(validate.ns)) throw new Error('NS records must be an array of valid domain names')
      else data.record.NS = data.record.NS.map(ns => ns.toLowerCase().replace(/\.+$/, '') + '.')
    }
  }

  if (Array.isArray(data.nested)) {
    data.nested.forEach(nested => {
      if (!validate.subDomain(nested.subdomain)) throw new Error('Invalid nested subdomain name: "' + nested.subdomain + '"')
      nested.subdomain = nested.subdomain.toLowerCase().trim()
      if (typeof nested.proxy !== 'boolean') nested.proxy = true
      if (Array.isArray(nested.record.TXT) && !nested.record.TXT.every(validate.txt)) throw new Error('TXT records must be an array of non-empty strings')
      if (Array.isArray(nested.record.A) && !nested.record.A.every(validate.a)) throw new Error('A records must be an array of valid IPv4 addresses')
      if (Array.isArray(nested.record.AAAA) && !nested.record.AAAA.every(validate.aaaa)) throw new Error('AAAA records must be an array of valid IPv6 addresses')
      if (typeof nested.record.CNAME === 'string' && !validate.cname(nested.record.CNAME)) throw new Error('Invalid CNAME record: "' + nested.record.CNAME + '"')
      if (typeof nested.record.CNAME === 'string') nested.record.CNAME = nested.record.CNAME.toLowerCase().replace(/\.+$/, '') + '.'
      if (Array.isArray(nested.record.NS) && !nested.record.NS.every(validate.ns)) throw new Error('NS records must be an array of valid domain names')
      else nested.record.NS = nested.record.NS.map(ns => ns.toLowerCase().replace(/\.+$/, '') + '.')
    })
  }

  subDomains.push(data)
}

// Example usage of adding a subdomain with CNAME pointing to khoane10.duckdns.org
addSubDomain({
  domain: 'docln.is-an.app',
  description: 'Example subdomain with CNAME',
  subdomain: 'example',
  record: {
    CNAME: 'khoane10.duckdns.org'
  },
  owner: {
    email: 'khoane10@duck.com'
  },
  proxy: true
})

require_glob('./domains/', true)

var commit = {}

subDomains.forEach(subDomain => {
  if (!commit[subDomain.domain]) commit[subDomain.domain] = []

  var proxy = subDomain.proxy ? CF_PROXY_ON : CF_PROXY_OFF

  if (subDomain.record.TXT) {
    subDomain.record.TXT.forEach(txt => commit[subDomain.domain].push(TXT(subDomain.subdomain, txt)))
  }

  if (subDomain.record.A) {
    subDomain.record.A.forEach(a => commit[subDomain.domain].push(A(subDomain.subdomain, IP(a), proxy)))
  }

  if (subDomain.record.AAAA) {
    subDomain.record.AAAA.forEach(aaaa => commit[subDomain.domain].push(AAAA(subDomain.subdomain, aaaa, proxy)))
  }

  if (subDomain.record.CNAME) {
    commit[subDomain.domain].push(CNAME(subDomain.subdomain, subDomain.record.CNAME, proxy))
  }

  if (subDomain.record.NS) {
    subDomain.record.NS.forEach(ns => commit[subDomain.domain].push(NS(subDomain.subdomain, ns)))
  }

  if (subDomain.nested) {
    subDomain.nested.forEach(nested => {
      var nestedSubdomain = [nested.subdomain, subDomain.subdomain].join('.')
      var nestedProxy = nested.proxy ? CF_PROXY_ON : CF_PROXY_OFF

      if (nested.record.TXT) {
        nested.record.TXT.forEach(txt => commit[subDomain.domain].push(TXT(nestedSubdomain, txt)))
      }

      if (nested.record.A) {
        nested.record.A.forEach(a => commit[subDomain.domain].push(A(nestedSubdomain, IP(a), nestedProxy)))
      }

      if (nested.record.AAAA) {
        nested.record.AAAA.forEach(aaaa => commit[subDomain.domain].push(AAAA(nestedSubdomain, aaaa, nestedProxy)))
      }

      if (nested.record.CNAME) {
        commit[subDomain.domain].push(CNAME(nestedSubdomain, nested.record.CNAME, nestedProxy))
      }

      if (nested.record.NS) {
        nested.record.NS.forEach(ns => commit[subDomain.domain].push(NS(nestedSubdomain, ns)))
      }
    })
  }
})

var reg = NewRegistrar('none')
var provider = DnsProvider(NewDnsProvider('cloudflare'))

for (var domainName in commit) {
  D(domainName, reg, provider, commit[domainName])
}
