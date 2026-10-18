import { AgentV2 } from "@allcode/core/agent"
import { AISDK } from "@allcode/core/aisdk"
import { Catalog } from "@allcode/core/catalog"
import { CommandV2 } from "@allcode/core/command"
import { Config } from "@allcode/core/config"
import { Credential } from "@allcode/core/credential"
import { AppNodeBuilder } from "@allcode/core/effect/app-node-builder"
import { LayerNodePlatform } from "@allcode/core/effect/app-node-platform"
import { LayerNode } from "@allcode/core/effect/layer-node"
import { EventV2 } from "@allcode/core/event"
import { FileSystem } from "@allcode/core/filesystem"
import { FSUtil } from "@allcode/core/fs-util"
import { Integration } from "@allcode/core/integration"
import { Location } from "@allcode/core/location"
import { Npm } from "@allcode/core/npm"
import { Policy } from "@allcode/core/policy"
import { PluginV2 } from "@allcode/core/plugin"
import { Reference } from "@allcode/core/reference"
import { SkillV2 } from "@allcode/core/skill"
import { Effect, Layer } from "effect"
import { tempLocationLayer } from "../fixture/location"

const npmLayer = Layer.succeed(
  Npm.Service,
  Npm.Service.of({
    add: () => Effect.succeed({ directory: "", entrypoint: undefined }),
    install: () => Effect.void,
    which: () => Effect.succeed(undefined),
  }),
)

export const PluginTestLayer = AppNodeBuilder.build(
  LayerNode.group([
    FileSystem.node,
    FSUtil.node,
    Location.node,
    Npm.node,
    Policy.node,
    Config.node,
    Credential.node,
    EventV2.node,
    LayerNodePlatform.httpClient,
    PluginV2.node,
    AgentV2.node,
    AISDK.node,
    Catalog.node,
    CommandV2.node,
    Integration.node,
    Reference.node,
    SkillV2.node,
  ]),
  [
    [Location.node, tempLocationLayer],
    [Npm.node, npmLayer],
  ],
)
