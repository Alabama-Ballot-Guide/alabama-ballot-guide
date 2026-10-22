(function () {
  document.documentElement.lang = "en";
  var G = window.GUIDE;
  var PARTY = { R: "Republican", D: "Democrat", L: "Libertarian", I: "Independent" };
  var main = document.getElementById("content");
  var live = document.getElementById("live");
  var picks = load("al-guide-picks-2026", {});
  var topic = "all";
  // Pre-render (build time) writes content only; interactive controls are added in the browser
  var STATIC = !!window.__PRERENDER;
  function sep(t) { return '<span class="sr-only">' + t + "</span>"; }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function today() {
    var d = new Date();
    try {
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d);
      var get = function (t) { return +parts.filter(function (x) { return x.type === t; })[0].value; };
      return new Date(get("year"), get("month") - 1, get("day"));
    } catch (e) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  }
  function parseISO(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  // Only https: links and the guide's own data files may become hrefs; anything else is neutralized.
  function safeUrl(u) {
    u = String(u == null ? "" : u).trim();
    return /^https:\/\/[^\s"'<>]+$/i.test(u) || /^(guide\.json|guide\.md|llms\.txt)$/.test(u) ? u : "#invalid-link";
  }
  function isView(n) { return Object.prototype.hasOwnProperty.call(VIEWS, n); }
  function ext(url, text, cls) {
    return '<a' + (cls ? ' class="' + cls + '"' : "") + ' href="' + esc(safeUrl(url)) + '" target="_blank" rel="noopener">' + text +
      '<span class="sr-only"> (opens in new tab)</span></a>';
  }
  function topicsOf(p) { return Array.isArray(p.topic) ? p.topic : [p.topic]; }
  function partyLabel(c) { return c.partyName || PARTY[c.party] || c.party; }
  function announce(msg) { live.textContent = ""; setTimeout(function () { live.textContent = msg; }, 30); }

  // ---------- laws and bills ----------
  // Each law is described once in G.laws and listed in one section ("Laws and bills in this guide", at the
  // top of the footer, so it sits below every tab). The first mention in each position or differ line links
  // there; a mouse hover or keyboard focus also shows the one-line summary. No lookbehind: older Safari lacks it.
  var LAWS = (G.laws || []).map(function (l) {
    return { law: l, res: (l.match || []).map(function (m) {
      return new RegExp("(^|[^A-Za-z0-9])(" + m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![A-Za-z0-9])", "i");
    }) };
  });
  var LAW_BY_ANCHOR = {};
  LAWS.forEach(function (x) { LAW_BY_ANCHOR["law-" + x.law.id] = x.law; });
  // html is already escaped; law names contain none of the characters esc() changes. Only text between
  // tags is searched, never a tag or a link added for an earlier law, so a phrase can't break the markup.
  function linkLaws(html, seen) {
    LAWS.forEach(function (x) {
      if (seen[x.law.id]) return;
      var parts = html.split(/(<[^>]*>)/);             // odd indexes are tags
      for (var i = 0; i < x.res.length; i++) {
        for (var j = 0, inLink = false; j < parts.length; j++) {
          if (j % 2) { inLink = /^<a[\s>]/i.test(parts[j]) || (inLink && !/^<\/a>/i.test(parts[j])); continue; }
          if (inLink || !x.res[i].test(parts[j])) continue;
          parts[j] = parts[j].replace(x.res[i], function (all, pre, t) { return pre + '<a class="law" href="#law-' + esc(x.law.id) + '">' + t + "</a>"; });
          seen[x.law.id] = 1;
          html = parts.join("");
          return;
        }
      }
    });
    return html;
  }
  function lawsSection() {
    if (!LAWS.length) return "";
    return '<section class="laws-ref" id="laws" aria-labelledby="lawsH"><div class="wrap"><h2 id="lawsH">Laws and bills in this guide</h2>' +
      '<p class="laws-intro">Short, neutral descriptions of the laws and bills candidates mention. A law’s name in a candidate’s entry links here.</p>' +
      '<dl class="laws-list">' + LAWS.map(function (x) {
        var l = x.law;
        return '<div class="law-item" id="law-' + esc(l.id) + '"><dt>' + esc(l.term) + ' <span class="kind">' + esc(l.kind) + "</span></dt><dd>" + esc(l.d) +
          ((l.src || []).length ? ' <span class="law-src">Sources: ' + l.src.map(function (s) { return ext(s.url, esc(s.label)); }).join(" · ") + "</span>" : "") + "</dd></div>";
      }).join("") + "</dl></div></section>";
  }

  // ---------- render pieces ----------
  function card(c, raceId, raceName, target) {
    var on = picks[raceId] && picks[raceId].name === c.name;
    var srcs = c.sources || [];
    var pos = (c.positions || []).map(function (p) {
      var ts = topicsOf(p);
      var refs = (p.s || []).slice().sort(function (a, b) { return a - b; }).map(function (n) {
        var s = srcs[n - 1]; if (!s) return "";
        return '<a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener" aria-label="Source ' + n + ": " + esc(s.label) + ' (opens in new tab)">' + n + sep(" (source: " + esc(s.label) + ")") + "</a>";
      }).join("");
      var seen = {};
      return '<li data-topics="' + esc(ts.join(" ")) + '"><span class="t">' + esc(ts.map(function (t) { return G.topics[t] || t; }).join(" · ")) + "</span>" + sep(": ") +
        "<strong>" + linkLaws(esc(p.h), seen) + "</strong>" + sep(". ") + "<p>" + linkLaws(esc(p.d), seen) + (refs ? ' <span class="refs">' + refs + "</span>" : "") + "</p></li>";
    }).join("");
    var src = srcs.map(function (s) { return "<li>" + ext(s.url, esc(s.label)) + "</li>"; }).join("");
    return '<article class="cand">' +
      '<div class="cand-top"><div class="who">' +
        "<h4>" + esc(c.name) + (c.incumbent ? sep(", ") + '<span class="badge">Incumbent</span>' : "") + "</h4>" +
        '<div class="party ' + esc(c.party) + '">' + esc(partyLabel(c)) + "</div>" +
        (c.role ? '<p class="role">' + esc(c.role) + "</p>" : "") +
      "</div>" +
      (STATIC ? "" : '<button class="pick" type="button" aria-pressed="' + (on ? "true" : "false") + '" data-race="' + esc(raceId) +
        '" data-office="' + esc(raceName) + '" data-target="' + esc(target) + '" data-name="' + esc(c.name) + '" data-party="' + esc(partyLabel(c)) +
        '" aria-label="Mark ' + esc(c.name) + " as my pick for " + esc(raceName) + '"><span class="ov" aria-hidden="true"></span><span class="pl">' + (on ? "Picked" : "Pick") + "</span></button>") +
      "</div>" +
      '<ul class="positions">' + pos + "</ul>" +
      (STATIC ? "" : '<p class="empty-topic" hidden>' + esc(G.emptyTopic) + "</p>") +
      (src ? '<div class="cand-foot"><details><summary>Sources (' + srcs.length + ")</summary><ol>" + src + "</ol></details></div>" : "") +
      "</article>";
  }

  function differBox(x) {
    if (!x.differ || !x.differ.length) return "";
    return '<div class="differ"><p class="differ-h">Where they differ</p><ul>' + x.differ.map(function (i) {
      var both = i.k === "Both";
      return "<li><b>" + esc(both ? "Where they agree" : i.k) + ":</b> " + linkLaws(esc(both ? "Both " + i.v.charAt(0).toLowerCase() + i.v.slice(1) : i.v), {}) + "</li>";
    }).join("") + "</ul></div>";
  }
  var mine = load("al-guide-mine", {});
  var showAllHouse = false, showAllBoe = false;

  function raceHead(r) {
    return '<div class="race-head"><div>' +
      (r.eyebrow ? '<p class="eyebrow">' + esc(r.eyebrow) + "</p>" : "") +
      '<h3 class="office">' + esc(r.office) + "</h3>" +
      (r.does ? '<p class="does">' + esc(r.does) + "</p>" : "") +
      "</div>" + (r.status ? '<span class="status">' + esc(r.status) + "</span>" : "") + "</div>";
  }

  function raceFoot(o) {
    var bits = [];
    if (o.debate) bits.push("<p><b>Debates:</b> " + esc(o.debate) + "</p>");
    if (o.note) bits.push("<p>" + esc(o.note) + "</p>");
    if (o.noteSrc && o.noteSrc.length) bits.push('<p class="ref-inline">Sources: ' + o.noteSrc.map(function (s) { return ext(s.url, esc(s.label)); }).join(" · ") + "</p>");
    return bits.length ? '<div class="race-foot">' + bits.join("") + "</div>" : "";
  }

  function fullRace(r) {
    return '<section class="race" id="' + esc(r.id) + '" data-kind="full" aria-labelledby="h-' + esc(r.id) + '">' +
      raceHead(r).replace('<h3 class="office">', '<h3 class="office" id="h-' + esc(r.id) + '">') + differBox(r) +
      '<div class="cands">' + r.candidates.map(function (c) { return card(c, r.id, r.office, r.id); }).join("") + "</div>" +
      raceFoot(Object.assign({ debate: G.defaultDebate }, r)) + "</section>";
  }

  function rowsRace(r) {
    var rows = r.rows.map(function (row) {
      var cs = row.text
        ? "<div><em>" + esc(row.text) + (row.link ? " " + ext(row.link.url, esc(row.link.label)) : "") + "</em></div>"
        : row.cands.map(function (c) {
          return "<div><span>" + esc(c.name) + (c.incumbent ? sep(", ") + '<span class="badge">Incumbent</span>' : "") + "</span>" + sep(", ") +
            '<span class="party ' + esc(c.party) + '">' + esc(partyLabel(c)) + "</span>" +
            (c.note ? sep(". ") + "<em>" + esc(c.note) + "</em>" : "") + "</div>";
        }).join("");
      var boe = r.id === "school-board" ? (/District (\d)/.exec(row.office) || [])[1] : null;
      return '<div class="row"' + (boe ? ' data-boe="' + boe + '"' : "") + '><div class="o"><b>' + esc(row.office) + "</b>" + (row.sub ? "<span>" + esc(row.sub) + "</span>" : "") +
        '</div><div class="c">' + cs + "</div></div>";
    }).join("");
    return '<section class="race" id="' + esc(r.id) + '" data-kind="rows">' + raceHead(r) +
      (r.id === "school-board" && !STATIC ? '<p class="mine-note" id="boeNote" hidden></p>' : "") +
      '<div class="rows">' + rows + "</div>" + raceFoot(r) + "</section>";
  }

  function districtsRace(r) {
    var tabs = r.districts.map(function (d, i) {
      return '<button class="tab" type="button" role="tab" id="tab-al' + esc(d.n) + '" aria-controls="panel-al' + esc(d.n) +
        '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '" data-n="' + esc(d.n) + '"><b>District ' + esc(d.n) + "</b>" + sep(": ") + "<span>" + esc(d.short) + "</span></button>";
    }).join("");
    var panels = r.districts.map(function (d, i) {
      var name = "U.S. House, District " + d.n;
      return '<div class="panel"' + (STATIC ? "" : ' role="tabpanel" aria-labelledby="tab-al' + esc(d.n) + '"') + ' id="panel-al' + esc(d.n) + '"' + (i && !STATIC ? " hidden" : "") + ">" +
        '<h3 class="district-area" id="al-' + esc(d.n) + '"><b>District ' + esc(d.n) + "</b> · " + esc(d.area) + (d.status ? " · " + esc(d.status) : "") + "</h3>" + differBox(d) +
        '<div class="cands">' + d.candidates.map(function (c) { return card(c, "house", name, "al" + d.n); }).join("") + "</div>" +
        raceFoot(Object.assign({ debate: G.defaultDebate }, d)) + "</div>";
    }).join("");
    return '<section class="race" id="' + esc(r.id) + '" data-kind="districts">' + raceHead(r) +
      '<p class="find">' + esc(r.findText) + " " + ext(r.findLink.url, esc(r.findLink.label)) + "</p>" +
      (STATIC ? "" : '<p class="mine-note" id="houseNote" hidden></p>') +
      (STATIC ? "" : '<div class="tabs" role="tablist" aria-label="Congressional districts">' + tabs + "</div>") + panels +
      raceFoot(r) + "</section>";
  }

  function absenteeBox(now) {
    var st = G.absenteeStages.filter(function (s) { return parseISO(s.until) >= now; })[0] || G.absenteeStages[G.absenteeStages.length - 1];
    var target = st.cta === "Election Day details" ? "election-day" : st.cta === "Provisional ballot details" ? "forget-id" : "absentee";
    return '<a class="callout" href="#' + target + '"><span class="ic" aria-hidden="true"></span><span class="tx"><span class="ct">' + esc(st.title) + '</span><span class="cb">' +
      esc(st.text) + '</span><span class="cta">' + esc(st.cta) + " →</span></span></a>";
  }

  function findBallot() {
    var F = G.findBallot, house = G.groups[1].races.filter(function (r) { return r.districts; })[0];
    var boeRace = G.groups[0].races.filter(function (r) { return r.id === "school-board"; })[0];
    var s1 = '<li><b>' + esc(F.step1.h) + "</b><span>" + esc(F.step1.d) + "</span>" + ext(F.step1.link.url, esc(F.step1.link.label) + " ↗", "fb-link") + "</li>";
    if (STATIC) return '<section class="find-ballot" id="find" aria-labelledby="findH"><h2 id="findH">' + esc(F.title) + "</h2><p>" + esc(F.intro) + '</p><ol class="fb-steps">' + s1 + "</ol></section>";
    var hOpts = '<option value="">Not sure yet</option>' + house.districts.map(function (d) {
      return '<option value="' + esc(d.n) + '"' + (String(mine.house) === String(d.n) ? " selected" : "") + ">District " + esc(d.n) + " · " + esc(d.short) + "</option>";
    }).join("");
    var bOpts = '<option value="">Not sure yet</option>' + boeRace.rows.map(function (row) {
      var n = (/District (\d)/.exec(row.office) || [])[1];
      return '<option value="' + n + '"' + (String(mine.boe) === n ? " selected" : "") + ">" + esc(row.office) + "</option>";
    }).join("") + '<option value="none"' + (mine.boe === "none" ? " selected" : "") + ">Another district (no race this year)</option>";
    return '<section class="find-ballot" id="find" aria-labelledby="findH"><h2 id="findH">' + esc(F.title) + "</h2><p>" + esc(F.intro) + '</p><ol class="fb-steps">' + s1 +
      '<li><b>' + esc(F.step2.h) + "</b><span>" + esc(F.step2.d) + '</span><div class="fb-pickers">' +
        '<label for="myHouse">U.S. House district<select id="myHouse">' + hOpts + "</select></label>" +
        '<label for="myBoe">State Board of Education district<select id="myBoe">' + bOpts + "</select></label>" +
      '</div></li></ol><p class="fb-status" id="fbStatus" aria-live="polite"></p></section>';
  }

  function render() {
    var now = today();
    var election = parseISO(G.electionDate);
    var days = Math.round((election - now) / 86400000);
    var html = "";

    html += '<div class="view" data-view="overview" id="view-overview"><section class="hero"><div class="wrap">' +
      '<p class="eyebrow">' + esc(G.heroEyebrow) + "</p>" +
      "<h1>" + esc(G.heroTitle) + "</h1>" +
      '<p class="lede">' + esc(G.heroLede) + "</p>" +
      '<p class="meta">' + G.heroMeta.map(function (m) { return "<span>" + esc(m) + "</span>"; }).join("") + "</p>" +
      '<p class="es" lang="es">' + esc(G.spanish.text) + " " + (G.spanishGuide ? '<a href="#espanol">' + esc(G.spanishGuide.title) + "</a> · " : "") +
        G.spanish.links.map(function (l) { return ext(l.url, esc(l.label)); }).join(" · ") + "</p>" +
      findBallot() +
      '<div class="dates">' + G.dates.map(function (d) {
        var past = d.iso && parseISO(d.iso) < now;
        var s = past && d.pastNote ? d.pastNote : d.s;
        if (d.countdown && days > 0) s += " · " + days + (days === 1 ? " day away" : " days away");
        return '<a class="date' + (past ? " past" : "") + '" href="#' + esc(d.target) + '"><span class="k">' + esc(d.k) + "</span>" + sep(": ") + '<span class="v">' + esc(d.v) +
          "</span>" + sep(". ") + '<span class="s">' + esc(s) + "</span></a>";
      }).join("") + "</div>" +
      '<div class="callouts">' + absenteeBox(now) +
      '<a class="callout" href="#' + esc(G.idCard.target) + '"><span class="ic id" aria-hidden="true"></span><span class="tx"><span class="ct">' + esc(G.idCard.title) + '</span><span class="cb">' +
        esc(G.idCard.text) + '</span><span class="cta">' + esc(G.idCard.cta) + " →</span></span></a></div>" +
      "</div></section>";

    var filterHtml = "";
    var used = {};
    G.groups.forEach(function (g) { g.races.forEach(function (r) {
      var all = (r.candidates || []).slice();
      (r.districts || []).forEach(function (d) { all = all.concat(d.candidates); });
      all.forEach(function (c) { (c.positions || []).forEach(function (p) { topicsOf(p).forEach(function (t) { used[t] = 1; }); }); });
    }); });
    var chipKeys = Object.keys(G.topics).filter(function (k) { return used[k]; });
    if (!STATIC) filterHtml = '<div class="filter" id="filter"><div class="wrap"><div class="filter-row"><span class="filter-label" id="filterLabel">Filter by issue</span>' +
      '<div class="chips" role="group" aria-labelledby="filterLabel">' +
      '<button class="chip" type="button" data-topic="all" aria-pressed="true">All issues</button>' +
      chipKeys.map(function (k) { return '<button class="chip" type="button" data-topic="' + esc(k) + '" aria-pressed="false">' + esc(G.topics[k]) + "</button>"; }).join("") +
      '</div></div><p class="filter-status" id="filterStatus"></p></div></div>';

    html += '<section class="index" id="races" tabindex="-1"><div class="wrap"><h2>On your ballot</h2><div class="index-grid">' +
      G.groups.map(function (g) { return g.races.map(function (r) {
        return '<a href="#' + esc(r.id) + '" data-race="' + esc(r.id) + '"><b>' + esc(r.short || r.office) + "</b><span>" + esc(r.indexNote || "") + "</span></a>";
      }).join(""); }).join("") +
      '<a class="util" href="#amendments"><b>Amendments</b><span>' + G.amendments.length + " statewide questions</span></a>" +
      '<a class="util" href="#vote"><b>How to vote</b><span>ID, absentee, polling hours</span></a>' +
      "</div></div></section></div>" + filterHtml;

    G.groups.forEach(function (g) {
      var vn = g.id === "federal" ? "congress" : g.id;
      html += '<div class="view" data-view="' + esc(vn) + '" id="view-' + esc(vn) + '"><section class="group" id="' + esc(g.id) + '"><div class="wrap"><h1>' + esc(g.title) + "</h1>" +
        (g.intro ? '<p class="group-intro">' + esc(g.intro) + "</p>" : "") +
        (g.src ? '<p class="group-src">Sources: ' + g.src.map(function (s) { return ext(s.url, esc(s.label)); }).join(" · ") + "</p>" : "") +
        g.races.map(function (r) {
          return r.districts ? districtsRace(r) : r.rows ? rowsRace(r) : fullRace(r);
        }).join("") + "</div></section></div>";
    });

    html += '<div class="view" data-view="amendments" id="view-amendments"><section class="group" id="amendments"><div class="wrap"><h1>Statewide amendments</h1>' +
      '<p class="group-intro">' + esc(G.amendIntro) + "</p>" +
      '<nav class="index-grid amend-index" aria-label="The four amendments">' + G.amendments.map(function (a, i) {
        return '<a href="#amend-' + (i + 1) + '"><b>' + esc(a.title) + "</b><span>" + esc(a.n.replace(/^Statewide /, "")) + "</span></a>";
      }).join("") + '</nav><div class="amends">' +
      G.amendments.map(function (a, i) {
        return '<article class="amend" id="amend-' + (i + 1) + '"><p class="eyebrow">' + esc(a.n) + "</p><h3>" + esc(a.title) + '</h3><p class="sum">' + esc(a.summary) + "</p>" +
          "<dl><dt>Legislature’s vote</dt><dd>" + esc(a.vote) + "</dd><dt>Supporters say</dt><dd>" + esc(a.support) + "</dd><dt>Opponents say</dt><dd>" + esc(a.oppose) + "</dd></dl>" +
          '<div class="yn"><div class="y"><b>A yes vote</b>' + sep(": ") + esc(a.yes) + '</div><div class="n"><b>A no vote</b>' + sep(": ") + esc(a.no) + "</div></div>" +
          (a.src ? '<p class="src">Sources: ' + a.src.map(function (s) { return ext(s.url, esc(s.label)); }).join(" · ") + "</p>" : "") +
          "</article>";
      }).join("") + "</div></div></section></div>";

    function spanishGuide() {
      var S = G.spanishGuide; if (!S) return "";
      return '<section class="es-guide" id="espanol" lang="es" aria-labelledby="esH"><h2 id="esH">' + esc(S.title) + "</h2><p>" + esc(S.intro) + "</p><dl>" +
        S.items.map(function (x) { return "<dt>" + esc(x.h) + "</dt><dd>" + esc(x.p) + "</dd>"; }).join("") + "</dl>" +
        '<p class="links">' + S.links.map(function (l) { return ext(l.url, esc(l.label) + " ↗"); }).join("") + "</p></section>";
    }
    // Application vs. ballot, by mail vs. by hand: four deadlines side by side
    function deadlineTable(t) {
      return '<div class="deadlines"><table><caption>' + esc(t.caption) + "</caption><thead><tr><td></td>" +
        t.cols.map(function (c) { return '<th scope="col">' + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
        t.rows.map(function (r) { return '<tr><th scope="row">' + esc(r.h) + "</th>" + r.c.map(function (c, i) { return '<td data-label="' + esc(t.cols[i].split(" (")[0]) + '">' + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") +
        "</tbody></table>" + (t.note ? '<p class="note">' + esc(t.note) + "</p>" : "") + "</div>";
    }
    html += '<div class="view" data-view="vote" id="view-vote"><section class="group" id="vote"><div class="wrap"><h1>How to vote</h1>' +
      '<p class="group-intro">' + esc(G.voteIntro) + '</p><div class="steps">' +
      G.vote.map(function (s) {
        return '<div class="step' + (s.wide ? " wide" : "") + '"' + (s.id ? ' id="' + esc(s.id) + '"' : "") + "><h3>" + esc(s.h) + "</h3>" +
          (s.p ? "<p>" + esc(s.p) + "</p>" : "") +
          (s.list ? "<ul>" + s.list.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
          (s.deadlines ? deadlineTable(s.deadlines) : "") +
          (s.ol ? '<p class="steps-h">Steps</p><ol>' + s.ol.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" : "") +
          (s.after ? "<p>" + esc(s.after) + "</p>" : "") +
          (s.links ? '<p class="links">' + s.links.map(function (l) { return ext(l.url, esc(l.label) + " ↗"); }).join("") + "</p>" : "") +
          "</div>";
      }).join("") + "</div>" + spanishGuide() + "</div></section></div>";

    main.innerHTML = html;

    // Newest three updates show; the rest fold away so the list stays short as corrections accumulate
    function updatesList() {
      var item = function (x) {
        return "<li><b>" + esc(parseISO(x.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })) + ":</b> " + esc(x.text) + "</li>";
      };
      var older = G.updates.slice(3);
      return '<ul class="updates">' + G.updates.slice(0, 3).map(item).join("") + "</ul>" +
        (older.length ? '<details class="updates-more"><summary>Earlier updates (' + older.length + ")</summary>" +
          '<ul class="updates">' + older.map(item).join("") + "</ul></details>" : "");
    }
    document.getElementById("about").innerHTML = lawsSection() + '<div class="wrap"><h2>About this guide</h2><div class="about-grid">' + G.about.map(function (a) {
      return "<div><h3>" + esc(a.h) + "</h3><p>" + esc(a.p) +
        (a.links ? " " + a.links.map(function (l) { return '<a href="' + esc(safeUrl(l.url)) + '" type="' + esc(l.type) + '">' + esc(l.label) + "</a>"; }).join(", ") + "." : "") + "</p></div>";
    }).join("") + "</div>" +
      '<h3 class="updates-h">Updates</h3>' + updatesList() + "</div>";

    var cd = document.getElementById("countdown");
    cd.textContent = days > 1 ? "Election Day in " + days + " days" : days === 1 ? "Election Day is tomorrow" : days === 0 ? "Election Day is today" : "Election held Nov 3";
  }

  // ---------- behavior ----------
  var VIEWS = { overview: "Overview", state: "State races", congress: "Congress", amendments: "Amendments", vote: "How to vote" };
  var current = "overview";

  function showView(name) {
    if (!isView(name)) name = "overview";
    current = name;
    document.querySelectorAll(".view").forEach(function (v) { v.hidden = v.dataset.view !== name; });
    var f = document.getElementById("filter");
    if (f) f.hidden = !(name === "state" || name === "congress");
    document.querySelectorAll(".nav a").forEach(function (l) {
      if (l.getAttribute("href") === "#" + name) l.setAttribute("aria-current", "page"); else l.removeAttribute("aria-current");
    });
    document.title = (name === "overview" ? "" : VIEWS[name] + " · ") + "Alabama Ballot Guide 2026";
    if (topic !== "all" && (name === "state" || name === "congress")) applyTopic(); else setScrollPad();
  }

  // Go to a tab ("state"), a race or step inside a tab ("governor", "absentee"), or a district ("al-2")
  function go(token, focus, keepScroll) {
    var el = null, view = isView(token) ? token : null;
    var dm = /^al-?([1-7])$/.exec(token);
    if (token === "content") view = current;
    else if (!view) {
      el = dm ? document.getElementById("house") : document.getElementById(token);
      if (el && el.closest(".view")) view = el.closest(".view").dataset.view;
      else if (el && el.closest("#laws")) view = current; // the laws list sits below every tab
      else { el = null; view = "overview"; }
    }
    if (el && topic !== "all" && el.closest(".race[hidden], .group[hidden]")) { topic = "all"; applyTopic(); }
    showView(view);
    if (dm) {
      if (mine.house && String(mine.house) !== dm[1]) { showAllHouse = true; applyMine(); }
      var t = document.getElementById("tab-al" + dm[1]); if (t) selectTab(t, false);
    }
    var hash = "#" + (token === "content" ? current : token);
    try { if (focus && location.hash !== hash) history.pushState(null, "", hash); else history.replaceState(history.state, "", hash); } catch (e) {}
    routed = location.hash;
    if (keepScroll) { /* Back to a saved spot: the caller restores it */ } else if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
    if (focus) {
      var target = el || document.querySelector("#view-" + view + " h1, #view-" + view + " h2");
      if (target) { if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT)$/.test(target.tagName)) target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
      announce(VIEWS[view] + " tab");
    }
  }

  function setScrollPad() {
    var h = document.querySelector(".top").offsetHeight;
    document.documentElement.style.setProperty("--header-h", h + "px");
    var f = document.getElementById("filter");
    var sticky = f && !f.hidden && getComputedStyle(f).position === "sticky";
    document.documentElement.style.scrollPaddingTop = (h + (sticky ? f.offsetHeight : 0) + 16) + "px";
  }

  function selectTab(btn, focus) {
    var list = btn.parentElement;
    list.querySelectorAll(".tab").forEach(function (t) {
      var on = t === btn;
      t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    save("al-guide-district", btn.dataset.n);
    if (focus) btn.focus();
  }

  function applyMine() {
    if (mine.house && !document.getElementById("tab-al" + mine.house)) { delete mine.house; save("al-guide-mine", mine); }
    var houseSec = document.getElementById("house");
    var hn = mine.house && !showAllHouse ? String(mine.house) : null;
    houseSec.querySelectorAll(".tab").forEach(function (t) { t.hidden = !!hn && t.dataset.n !== hn; });
    if (hn) selectTab(document.getElementById("tab-al" + hn), false);
    var hNote = document.getElementById("houseNote");
    if (mine.house) {
      hNote.hidden = false;
      hNote.innerHTML = showAllHouse
        ? "Showing all districts. " + '<button class="linkbtn" type="button" data-mine="house-only">Show only my district (' + esc(mine.house) + ")</button>"
        : "Showing your district, District " + esc(mine.house) + ". " + '<button class="linkbtn" type="button" data-mine="house-all">Show all districts</button>';
    } else hNote.hidden = true;
    var bn = mine.boe && !showAllBoe ? String(mine.boe) : null;
    document.querySelectorAll("#school-board .row").forEach(function (row) { row.hidden = !!bn && row.dataset.boe !== bn; });
    var bNote = document.getElementById("boeNote");
    if (mine.boe) {
      bNote.hidden = false;
      bNote.innerHTML = showAllBoe
        ? "Showing all districts. " + '<button class="linkbtn" type="button" data-mine="boe-only">Show only my district</button>'
        : (mine.boe === "none" ? "Your district has no State Board of Education race this year. " : "Showing your district, District " + esc(mine.boe) + ". ") +
          '<button class="linkbtn" type="button" data-mine="boe-all">Show all districts</button>';
    } else bNote.hidden = true;
    var idxHouse = document.querySelector('.index-grid a[data-race="house"] span');
    if (idxHouse) {
      var d = mine.house && G.groups[1].races.filter(function (r) { return r.districts; })[0].districts.filter(function (x) { return String(x.n) === String(mine.house); })[0];
      idxHouse.textContent = d ? "Your district: " + d.n + " · " + d.candidates.map(function (c) { return c.name.split(" ").filter(function (w) { return !/^(Jr\.|Sr\.)$/.test(w); }).pop(); }).join(" · ") : "Districts 1–7";
    }
    var st = document.getElementById("fbStatus");
    if (st) {
      var bits = [];
      if (mine.house) bits.push('<a href="#al-' + esc(mine.house) + '">Your U.S. House race →</a>');
      if (mine.boe && mine.boe !== "none") bits.push('<a href="#school-board">Your school board race →</a>');
      st.innerHTML = bits.length ? "Saved. " + bits.join(" ") + ' <button class="linkbtn" type="button" data-mine="clear">Clear my districts</button>' : "";
    }
    if (topic !== "all") applyTopic();
  }

  function applyTopic() {
    var label = G.topics[topic];
    document.querySelectorAll(".chip").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.topic === topic)); });
    document.querySelectorAll(".cand").forEach(function (cardEl) {
      var shown = 0;
      cardEl.querySelectorAll(".positions li").forEach(function (li) {
        var vis = topic === "all" || li.dataset.topics.split(" ").indexOf(topic) > -1;
        li.hidden = !vis; if (vis) shown++;
      });
      cardEl.querySelector(".empty-topic").hidden = shown > 0;
    });
    var shownRaces = 0, shownDistricts = 0, other = 0;
    var otherView = current === "state" ? "congress" : "state";
    document.querySelectorAll(".race").forEach(function (sec) {
      var vis, here = !!sec.closest("#view-" + current);
      if (topic === "all") vis = true;
      else if (sec.dataset.kind === "rows") vis = false;
      else vis = !!sec.querySelector('.positions li:not([hidden])');
      sec.hidden = !vis;
      if (vis && sec.dataset.kind === "full") { if (here) shownRaces++; else other++; }
      if (sec.dataset.kind === "districts") {
        var first = null, cur = sec.querySelector('.tab[aria-selected="true"]'), curMatch = false;
        sec.querySelectorAll(".tab:not([hidden])").forEach(function (t) {
          var panel = document.getElementById(t.getAttribute("aria-controls"));
          var m = topic !== "all" && !!panel.querySelector('.positions li:not([hidden])');
          t.classList.toggle("match", m);
          if (m) { if (here) shownDistricts++; else other++; if (!first) first = t; if (t === cur) curMatch = true; }
        });
        if (topic !== "all" && first && !curMatch) selectTab(first, false);
      }
    });
    document.querySelectorAll(".group").forEach(function (g) {
      if (g.id === "amendments" || g.id === "vote") return;
      g.hidden = topic !== "all" && !g.querySelector(".race:not([hidden])");
    });
    var status = document.getElementById("filterStatus");
    if (topic === "all") { status.innerHTML = ""; }
    else {
      var parts = [];
      if (shownRaces) parts.push(shownRaces + (shownRaces === 1 ? " race" : " races"));
      if (shownDistricts) parts.push(shownDistricts + " U.S. House " + (shownDistricts === 1 ? "district" : "districts") + " (marked •)");
      var msg = label + ": positions found in " + (parts.length ? parts.join(" and ") : "no races") + " on this tab.";
      var note = G.topicNotes && G.topicNotes[topic];
      status.innerHTML = "<span>" + esc(msg) + "</span>" +
        (other ? '<a class="linkbtn" href="#' + otherView + '">' + other + " more in " + esc(VIEWS[otherView]) + " →</a>" : "") +
        '<button class="linkbtn" type="button" id="showAll">Show all issues</button>' +
        (note ? '<span class="tn">' + esc(note) + "</span>" : "");
      announce(msg + (other ? " " + other + " more in " + VIEWS[otherView] + "." : ""));
    }
    setScrollPad();
  }

  function refreshPicks() {
    var keys = Object.keys(picks);
    document.getElementById("picksN").textContent = keys.length;
    document.getElementById("picksBtn").setAttribute("aria-label", "My picks, " + keys.length + (keys.length === 1 ? " pick" : " picks"));
    var list = document.getElementById("picksList");
    list.innerHTML = keys.length ? keys.map(function (k) {
      var p = picks[k];
      var tok = p.target && p.target.indexOf("al") === 0 ? "al-" + p.target.slice(2) : (p.target || k);
      return '<li><a href="#' + esc(tok) + '" data-target="' + esc(p.target || k) + '"><span>' + esc(p.office) + "</span><b>" + esc(p.name) + "</b><span>" + esc(p.party) + "</span></a></li>";
    }).join("") : '<li class="empty">No picks yet. Fill an oval on any candidate card.</li>';
    document.querySelectorAll(".pick").forEach(function (b) {
      var p = picks[b.dataset.race], on = !!p && p.name === b.dataset.name;
      b.setAttribute("aria-pressed", String(on));
      b.querySelector(".pl").textContent = on ? "Picked" : "Pick";
    });
  }

  render();
  if (STATIC) return;
  document.getElementById("picksSlot").outerHTML =
    '<button class="picks-btn" id="picksBtn" type="button" aria-expanded="false" aria-controls="sheet" aria-haspopup="dialog"><span><span class="my">My </span>picks</span><span class="n" id="picksN">0</span></button>';
  document.getElementById("sheet").innerHTML =
    '<h2 id="sheetTitle">My picks</h2><p class="hint">Fill an oval on any candidate to note your choice. Picks are saved only in this browser.</p>' +
    '<ul id="picksList"></ul><div class="actions"><button class="linkbtn" id="clearPicks" type="button">Clear all</button>' +
    '<button class="linkbtn" id="closeSheet" type="button">Close</button></div>';
  applyTopic();
  refreshPicks();
  applyMine();
  document.addEventListener("change", function (e) {
    if (e.target.id === "myHouse" || e.target.id === "myBoe") {
      mine = { house: document.getElementById("myHouse").value, boe: document.getElementById("myBoe").value };
      if (!mine.house) delete mine.house; if (!mine.boe) delete mine.boe;
      showAllHouse = false; showAllBoe = false;
      save("al-guide-mine", mine); applyMine();
      announce(mine.house || mine.boe ? "Saved your districts. The guide now shows your races." : "Cleared your districts.");
    }
  });

  // Open the House race on the voter's district: their pick, then their last tab
  (function () {
    var hp = picks.house, n = hp && hp.target ? hp.target.replace("al", "") : load("al-guide-district", null);
    var t = n && document.getElementById("tab-al" + n);
    if (t) selectTab(t, false);
  })();
  var routed = "";
  var lawFrom = null; // the law link last followed, so Back can return to it
  function route() {
    if (location.hash === routed) return;
    if (sheet && !sheet.hidden) toggleSheet(false, false); // Back/Forward leaves My picks closed, not floating over another tab
    var st = history.state, back = !!st && typeof st.y === "number";
    go(location.hash.slice(1) || "overview", false, back);
    // Back from the laws list: return to the exact spot the reader left
    if (back) {
      // after hashchange the browser also scrolls to the tab's own anchor; restore once more on the next frame
      var y = st.y, put = function () {
        window.scrollTo({ top: y, behavior: "instant" });
        if (lawFrom && document.contains(lawFrom)) lawFrom.focus({ preventScroll: true });
      };
      put(); requestAnimationFrame(function () { requestAnimationFrame(put); });
    }
  }
  go(location.hash.slice(1) || "overview", false);
  // A shared link to a section (#absentee): at load the browser scrolls to the fragment again and overshoots
  // (by about a header's height), so settle on the section once that scroll has started
  var firstHash = location.hash;
  window.addEventListener("load", function () {
    var tok = firstHash.slice(1), dm = /^al-?([1-7])$/.exec(tok);
    var el = dm ? document.getElementById("house") : tok && !isView(tok) ? document.getElementById(tok) : null;
    if (!el || !(el.closest(".view") || el.closest("#laws"))) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      if (location.hash === firstHash) el.scrollIntoView({ behavior: "instant" });
    }); });
  });
  window.addEventListener("hashchange", route);
  window.addEventListener("popstate", route);
  setScrollPad();
  window.addEventListener("resize", setScrollPad);

  // Law summaries: on mouse hover or keyboard focus, a one-line tooltip; a click or tap goes to the full entry.
  // Touch shows nothing (no hover there). The tip can be hovered and Esc closes it (WCAG 1.4.13).
  var tip = null, tipFor = null, tipKey = false, tipTimer = null;
  function showTip(a, viaKey) {
    var l = LAW_BY_ANCHOR[a.getAttribute("href").slice(1)];
    if (!l || !l.short) return;
    if (!tip) {
      tip = document.createElement("div"); tip.className = "law-tip"; tip.id = "lawTip"; tip.setAttribute("role", "tooltip"); tip.hidden = true;
      tip.addEventListener("pointerenter", function () { clearTimeout(tipTimer); });
      tip.addEventListener("pointerleave", hideTipSoon);
      document.body.appendChild(tip);
    }
    clearTimeout(tipTimer);
    if (tipFor && tipFor !== a) tipFor.removeAttribute("aria-describedby");
    tip.innerHTML = "<b>" + esc(l.term) + ":</b> " + esc(l.short) + '<span class="hint">' + (viaKey ? "Press Enter" : "Click") + " for the full explanation</span>";
    tip.hidden = false; tipFor = a; tipKey = viaKey; a.setAttribute("aria-describedby", "lawTip");
    var r = a.getBoundingClientRect(), vw = document.documentElement.clientWidth, head = document.querySelector(".top").offsetHeight;
    var top = r.top - tip.offsetHeight - 8;
    if (top < head + 4) top = r.bottom + 8;
    tip.style.left = Math.max(8, Math.min(r.left, vw - tip.offsetWidth - 8)) + "px";
    tip.style.top = top + "px";
  }
  function hideTip() {
    clearTimeout(tipTimer);
    if (tip) tip.hidden = true;
    if (tipFor) tipFor.removeAttribute("aria-describedby");
    tipFor = null;
  }
  function hideTipSoon() { clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 150); }
  function lawLink(t) { return t && t.closest ? t.closest("a.law") : null; }
  document.addEventListener("pointerover", function (e) {
    var a = lawLink(e.target);
    if (!a || e.pointerType !== "mouse") return;
    if (a === tipFor) clearTimeout(tipTimer); else showTip(a, false);
  });
  document.addEventListener("pointerout", function (e) {
    var a = lawLink(e.target);
    if (a && a === tipFor && !a.contains(e.relatedTarget)) hideTipSoon();
  });
  document.addEventListener("focusin", function (e) {
    var a = lawLink(e.target), kb = false;
    try { kb = !!a && a.matches(":focus-visible"); } catch (err) {}
    if (kb) showTip(a, true);
  });
  document.addEventListener("focusout", function (e) { if (e.target === tipFor) hideTip(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && tipFor) hideTip(); });
  // a mouse tip closes on scroll; a keyboard tip follows its link (focusing a link can itself scroll the page)
  window.addEventListener("scroll", function () { if (tipFor) { if (tipKey) showTip(tipFor, true); else hideTip(); } }, { passive: true });

  var sheet = document.getElementById("sheet"), scrim = document.getElementById("scrim"), btn = document.getElementById("picksBtn");
  var clearBtn = document.getElementById("clearPicks"), armTimer = null;
  function disarm() { clearTimeout(armTimer); clearBtn.dataset.armed = ""; clearBtn.textContent = "Clear all"; }
  function toggleSheet(open, returnFocus) {
    sheet.hidden = !open; scrim.hidden = !open; btn.setAttribute("aria-expanded", String(open));
    document.querySelectorAll("body > .skip, body > header, body > main, body > footer").forEach(function (el) { el.inert = open; });
    if (open) { sheet.setAttribute("tabindex", "-1"); sheet.focus(); }
    else { disarm(); if (returnFocus !== false) btn.focus(); }
  }

  document.addEventListener("click", function (e) {
    var mb = e.target.closest("[data-mine]");
    if (mb) {
      var a = mb.dataset.mine;
      if (a === "house-all") showAllHouse = true; else if (a === "house-only") showAllHouse = false;
      else if (a === "boe-all") showAllBoe = true; else if (a === "boe-only") showAllBoe = false;
      else if (a === "clear") { mine = {}; save("al-guide-mine", mine); document.getElementById("myHouse").value = ""; document.getElementById("myBoe").value = ""; }
      applyMine(); return;
    }
    if (e.target.id === "showAll") { topic = "all"; applyTopic(); document.querySelector('.chip[data-topic="all"]').focus(); return; }
    var chip = e.target.closest(".chip");
    if (chip) {
      topic = chip.dataset.topic; applyTopic();
      var f = document.getElementById("filter");
      if (window.scrollY > 0) window.scrollTo(0, 0);
      return;
    }
    var pick = e.target.closest(".pick");
    if (pick) {
      var r = pick.dataset.race;
      if (picks[r] && picks[r].name === pick.dataset.name) { delete picks[r]; announce(pick.dataset.name + " removed from your picks."); }
      else {
        picks[r] = { office: pick.dataset.office, name: pick.dataset.name, party: pick.dataset.party, target: pick.dataset.target };
        announce(pick.dataset.name + " saved as your pick for " + pick.dataset.office + ". " + Object.keys(picks).length + (Object.keys(picks).length === 1 ? " pick." : " picks."));
      }
      save("al-guide-picks-2026", picks); refreshPicks(); return;
    }
    var tab = e.target.closest(".tab");
    if (tab) { selectTab(tab, false); return; }
    var link = e.target.closest('a[href^="#"]');
    if (link) {
      var tok = link.getAttribute("href").slice(1);
      if (isView(tok) || tok === "content" || /^al-?[1-7]$/.test(tok) || document.getElementById(tok)) {
        e.preventDefault();
        if (link.closest("#picksList")) { if (topic !== "all") { topic = "all"; applyTopic(); } toggleSheet(false, false); }
        if (link.classList.contains("law")) {
          hideTip(); lawFrom = link;
          try { history.replaceState({ y: window.scrollY }, "", location.hash || "#" + current); } catch (err) {}
        }
        go(tok, true);
      }
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Tab" && !sheet.hidden) {
      // Keep keyboard focus inside My picks while it's open
      var f = Array.prototype.slice.call(sheet.querySelectorAll("a[href], button:not([disabled])"));
      if (f.length) {
        var first = f[0], last = f[f.length - 1], at = document.activeElement;
        if (e.shiftKey && (at === first || at === sheet)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (at === last || !sheet.contains(at))) { e.preventDefault(); first.focus(); }
      }
      return;
    }
    var tab = e.target.closest && e.target.closest(".tab");
    if (tab && ["ArrowRight", "ArrowLeft", "Home", "End"].indexOf(e.key) > -1) {
      var tabs = Array.prototype.slice.call(tab.parentElement.querySelectorAll(".tab"));
      var i = tabs.indexOf(tab);
      i = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : i + (e.key === "ArrowRight" ? 1 : -1);
      selectTab(tabs[(i + tabs.length) % tabs.length], true); e.preventDefault();
    }
    if (e.key === "Escape" && !sheet.hidden) toggleSheet(false);
  });
  btn.addEventListener("click", function () { toggleSheet(sheet.hidden); });
  scrim.addEventListener("click", function () { toggleSheet(false); });
  document.getElementById("closeSheet").addEventListener("click", function () { toggleSheet(false); });
  clearBtn.addEventListener("click", function () {
    if (!Object.keys(picks).length) return;
    if (clearBtn.dataset.armed) { picks = {}; save("al-guide-picks-2026", picks); refreshPicks(); disarm(); announce("All picks cleared."); return; }
    clearBtn.dataset.armed = "1"; clearBtn.textContent = "Tap again to clear all";
    armTimer = setTimeout(disarm, 4000);
  });
})();
