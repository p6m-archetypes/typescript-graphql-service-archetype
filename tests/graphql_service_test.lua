--- Acceptance suite for the TypeScript GraphQL service archetype (GraphQL Yoga + pnpm + Vitest).
--- Renders the project, verifies the layout and template substitution, installs it, runs its own
--- Vitest suite, then boots the real service and proves the GraphQL endpoint answers queries and
--- mutations over the wire, plus the management sidecar (health probes + Prometheus metrics).
---
--- The default configuration weaves in no resources (persistence/cache/messaging = None), so there
--- is a single variant - the resolvers return their empty/echo stubs. The GraphQL API is served by
--- GraphQL Yoga at /graphql on the service port; a management sidecar runs on a second port.
---
--- prova's in-process archetect engine renders once per run (prova.toml pins jobs = 1), so the whole
--- suite shares a single rendered tree (the `project` fixture). The static tier reads it with no
--- toolchain; the build and live tiers require `pnpm` (which drives Node) and skip cleanly without it.
---
--- Run from the archetype repo root (uses ./prova.toml):   prova

local SRC = "."

local ANSWERS = {
  author_name    = "Test Author",
  author_email   = "test@example.com",
  org_name       = "acme",
  solution_name  = "platform",
  prefix_name    = "Example",
  suffix_name    = "Service",
  image_registry = "ghcr.io/acme",
}

-- prefix Example / suffix Service => project dir `example-service`. The GraphQL type derives from
-- {{ PrefixName }}{{ SuffixName }} => ExampleService, with `listExampleServices` / `createExampleService`
-- resolvers.
local PROJECT_DIR = "example-service"

local EXPECTED_FILES = {
  "package.json",
  "tsconfig.json",
  "vitest.config.ts",
  "pnpm-workspace.yaml",
  ".npmrc",
  "src/index.ts",
  "src/schema.ts",
  "src/context.ts",
  "src/management.ts",
  "src/otel.ts",
  "src/settings.ts",
  "tests/health.test.ts",
  ".github/workflows/build.yaml",
  ".platform/docker/local/Dockerfile",
  ".platform/docker/prd/Dockerfile",
}

-- Render once for the whole suite (single in-process render; every tier shares this one tree).
local project = prova.fixture("typescript-graphql:project", Scope.Suite, function(ctx)
  local tree = archetect.render{
    source = SRC,
    answers = ANSWERS,
    destination = ctx:tempdir(),
    defaults = true,
  }
  return tree:dir(PROJECT_DIR)
end)

-- Install once (shared by the build tier and the live-service fixture). Only ever reached from
-- pnpm-gated groups, so `pnpm` is guaranteed present here.
local installed = prova.fixture("typescript-graphql:installed", Scope.Suite, function(ctx)
  local root = ctx:use(project)
  local install = shell.run("pnpm install", { cwd = root.path, timeout = "300s" })
  assert(install:ok(), "pnpm install failed:\n" .. install.stderr .. install.stdout)
  return root
end)

-- Boot the rendered service on free ports (HOST/SERVER_PORT/MANAGEMENT_PORT come from settings.ts).
-- Waiting on the management sidecar's /health/liveness proves both servers came up.
local service = prova.fixture("typescript-graphql:service", Scope.Suite, function(ctx)
  local root = ctx:use(installed)

  local port, mgmt = net.free_port(), net.free_port()
  ctx:manage(shell.spawn("pnpm exec tsx src/index.ts", {
    cwd = root.path,
    env = {
      HOST            = "127.0.0.1",
      SERVER_PORT     = tostring(port),
      MANAGEMENT_PORT = tostring(mgmt),
    },
  }))

  local mgmt_url = "http://127.0.0.1:" .. mgmt
  http.wait_for(mgmt_url .. "/health/liveness", { timeout = "60s" })
  return { service_url = "http://127.0.0.1:" .. port, mgmt_url = mgmt_url }
end)

-- Tier 1 - static: layout, template substitution, and generated k8s manifests. No toolchain.
prova.group("typescript-graphql layout", function(g)
  g:test("scaffolds the expected project layout", function(t)
    local root = t:use(project).path
    t:expect_all(function()
      for _, f in ipairs(EXPECTED_FILES) do
        t:expect(fs.exists(root .. "/" .. f), f):is_true()
      end
    end)
  end)

  g:test("wires prefix/suffix and ports through file contents", function(t)
    local root = t:use(project).path
    -- The GraphQL type + resolvers derive from {{ PrefixName }}{{ SuffixName }} => ExampleService.
    local schema = fs.read(root .. "/src/schema.ts")
    t:expect(schema, "GraphQL type"):contains("type ExampleService")
    t:expect(schema, "list resolver"):contains("listExampleServices")
    t:expect(schema, "create resolver"):contains("createExampleService")
    -- project-name lands in the package identity.
    t:expect(fs.read(root .. "/package.json"), "package name"):contains('"name": "example-service"')
    -- The service reads its ports from SERVER_PORT / MANAGEMENT_PORT.
    local settings = fs.read(root .. "/src/settings.ts")
    t:expect(settings, "service port env"):contains("SERVER_PORT")
    t:expect(settings, "management port env"):contains("MANAGEMENT_PORT")
  end)

  g:test("renders valid, non-empty kubernetes manifests", function(t)
    local root = t:use(project).path
    local manifests = fs.glob(root, ".platform/kubernetes/**/*.yaml")
    t:expect(#manifests > 0, "at least one k8s manifest"):is_true()
    t:expect_all(function()
      for _, m in ipairs(manifests) do
        local docs = yaml.parse_all(fs.read(m))
        t:expect(#docs > 0, m .. " has ≥1 document"):is_true()
      end
    end)
  end)

  g:test("leaves no unrendered template markers", function(t)
    t:expect(t:use(project)):is_fully_rendered()
  end)
end)

-- Tier 2 - build + unit: the generated project's own Vitest suite passes.
prova.group("typescript-graphql build + unit tests", { requires = { "pnpm" } }, function(g)
  g:test("the generated Vitest suite passes", function(t)
    local root = t:use(installed).path
    local vitest = shell.run("pnpm test", { cwd = root, timeout = "180s" })
    t:expect(vitest.code, "vitest exit code"):equals(0)
    t:expect(vitest.stdout .. vitest.stderr, "vitest reports a passing suite"):contains("passed")
  end)
end)

-- Tier 3 - live GraphQL: the running service answers real queries and mutations, and the management
-- sidecar answers real requests.
prova.group("typescript-graphql endpoints", { requires = { "pnpm" } }, function(g)
  g:test("the GraphQL list query returns the empty stub", function(t)
    local svc = t:use(service)
    local client = graphql.client{ url = svc.service_url .. "/graphql" }
    -- The unresolved `listExampleServices` query returns [] (no persistence in the default config).
    local data = client:query("{ listExampleServices { id displayName } }")
    t:expect(#data.listExampleServices, "listExampleServices is an empty list"):equals(0)
  end)

  g:test("the GraphQL mutation echoes its input", function(t)
    local svc = t:use(service)
    local client = graphql.client{ url = svc.service_url .. "/graphql" }
    local data = client:query(
      'mutation { createExampleService(displayName: "widget") { id displayName } }'
    )
    t:expect(data.createExampleService.displayName, "mutation echoes displayName"):equals("widget")
  end)

  g:test("the management sidecar reports readiness and liveness", function(t)
    local svc = t:use(service)

    local ready = http.get(svc.mgmt_url .. "/health/readiness")
    t:expect(ready.status, "readiness status code"):equals(200)
    t:expect(ready:json().status, "readiness body"):equals("ok")

    local live = http.get(svc.mgmt_url .. "/health/liveness")
    t:expect(live.status, "liveness status code"):equals(200)
    t:expect(live:json().status, "liveness body"):equals("ok")
  end)

  g:test("the management sidecar exposes Prometheus metrics", function(t)
    local svc = t:use(service)
    local r = http.get(svc.mgmt_url .. "/metrics")
    t:expect(r.status, "metrics status code"):equals(200)
    t:expect(r.body, "Prometheus exposition format"):contains("# HELP")
  end)
end)
