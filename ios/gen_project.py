#!/usr/bin/env python3
"""Writes SampleHunter.xcodeproj (project.pbxproj + shared scheme). Re-run after adding Swift files."""
import os, hashlib
here = os.path.dirname(os.path.abspath(__file__))
def uid(name): return hashlib.md5(name.encode()).hexdigest()[:24].upper()

swift = ['SampleHunterApp.swift', 'HunterWebView.swift', 'NativeBridge.swift']
T = 'SampleHunter'
ids = {k: uid(k) for k in ['project', 'mainGroup', 'appGroup', 'productsGroup', 'target', 'product', 'sources', 'frameworks', 'resources',
                           'assets', 'assetsBuild', 'web', 'webBuild', 'infoplist', 'projList', 'targetList', 'projDebug', 'projRelease',
                           'targetDebug', 'targetRelease']}
for f in swift: ids['ref:' + f] = uid('ref:' + f); ids['build:' + f] = uid('build:' + f)

common_proj = '''ALWAYS_SEARCH_USER_PATHS = NO;
				ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
				CLANG_ANALYZER_NONNULL = YES;
				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				CLANG_WARN_BOOL_CONVERSION = YES;
				CLANG_WARN_CONSTANT_CONVERSION = YES;
				CLANG_WARN_EMPTY_BODY = YES;
				CLANG_WARN_ENUM_CONVERSION = YES;
				CLANG_WARN_INFINITE_RECURSION = YES;
				CLANG_WARN_INT_CONVERSION = YES;
				CLANG_WARN_UNREACHABLE_CODE = YES;
				COPY_PHASE_STRIP = NO;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				ENABLE_USER_SCRIPT_SANDBOXING = YES;
				GCC_C_LANGUAGE_STANDARD = gnu17;
				GCC_NO_COMMON_BLOCKS = YES;
				GCC_WARN_64_TO_32_BIT_CONVERSION = YES;
				GCC_WARN_UNDECLARED_SELECTOR = YES;
				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
				GCC_WARN_UNUSED_FUNCTION = YES;
				GCC_WARN_UNUSED_VARIABLE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 16.0;
				LOCALIZATION_PREFERS_STRING_CATALOGS = YES;
				MTL_FAST_MATH = YES;
				SDKROOT = iphoneos;'''
proj_debug = common_proj + '''
				DEBUG_INFORMATION_FORMAT = dwarf;
				ENABLE_TESTABILITY = YES;
				GCC_OPTIMIZATION_LEVEL = 0;
				GCC_PREPROCESSOR_DEFINITIONS = (
					"DEBUG=1",
					"$(inherited)",
				);
				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
				ONLY_ACTIVE_ARCH = YES;
				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)";
				SWIFT_OPTIMIZATION_LEVEL = "-Onone";'''
proj_release = common_proj + '''
				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
				ENABLE_NS_ASSERTIONS = NO;
				MTL_ENABLE_DEBUG_INFO = NO;
				SWIFT_COMPILATION_MODE = wholemodule;
				VALIDATE_PRODUCT = YES;'''
target_settings = '''ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = "";
				ENABLE_PREVIEWS = YES;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_FILE = SampleHunter/Info.plist;
				INFOPLIST_KEY_CFBundleDisplayName = "Sample Hunter";
				INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;
				INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.music";
				INFOPLIST_KEY_NSCameraUsageDescription = "Sample Hunter can pull the sound out of a video you record.";
				INFOPLIST_KEY_NSMicrophoneUsageDescription = "Sample Hunter records the sounds around you and turns them into a drum kit, an 808 and a beat.";
				INFOPLIST_KEY_NSPhotoLibraryUsageDescription = "Sample Hunter can pull the sound out of videos in your library.";
				INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
				INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
				INFOPLIST_KEY_UIStatusBarStyle = UIStatusBarStyleLightContent;
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = UIInterfaceOrientationPortrait;
				INFOPLIST_KEY_UIUserInterfaceStyle = Dark;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = com.epsilonsounds.samplehunter;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";'''

I = ids
build_files = '\n'.join([f'\t\t{I["build:"+f]} /* {f} in Sources */ = {{isa = PBXBuildFile; fileRef = {I["ref:"+f]} /* {f} */; }};' for f in swift] + [
    f'\t\t{I["assetsBuild"]} /* Assets.xcassets in Resources */ = {{isa = PBXBuildFile; fileRef = {I["assets"]} /* Assets.xcassets */; }};',
    f'\t\t{I["webBuild"]} /* Web in Resources */ = {{isa = PBXBuildFile; fileRef = {I["web"]} /* Web */; }};'])
file_refs = '\n'.join([f'\t\t{I["ref:"+f]} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {f}; sourceTree = "<group>"; }};' for f in swift] + [
    f'\t\t{I["assets"]} /* Assets.xcassets */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; }};',
    f'\t\t{I["web"]} /* Web */ = {{isa = PBXFileReference; lastKnownFileType = folder; path = Web; sourceTree = "<group>"; }};',
    f'\t\t{I["infoplist"]} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; }};',
    f'\t\t{I["product"]} /* {T}.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = {T}.app; sourceTree = BUILT_PRODUCTS_DIR; }};'])
app_children = '\n'.join([f'\t\t\t\t{I["ref:"+f]} /* {f} */,' for f in swift] + [f'\t\t\t\t{I["web"]} /* Web */,', f'\t\t\t\t{I["assets"]} /* Assets.xcassets */,', f'\t\t\t\t{I["infoplist"]} /* Info.plist */,'])
src_files = '\n'.join([f'\t\t\t\t{I["build:"+f]} /* {f} in Sources */,' for f in swift])

pbx = f'''// !$*UTF8*$!
{{
	archiveVersion = 1;
	classes = {{
	}};
	objectVersion = 56;
	objects = {{

/* Begin PBXBuildFile section */
{build_files}
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
{file_refs}
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
		{I["frameworks"]} /* Frameworks */ = {{
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		}};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		{I["mainGroup"]} = {{
			isa = PBXGroup;
			children = (
				{I["appGroup"]} /* {T} */,
				{I["productsGroup"]} /* Products */,
			);
			sourceTree = "<group>";
		}};
		{I["appGroup"]} /* {T} */ = {{
			isa = PBXGroup;
			children = (
{app_children}
			);
			path = {T};
			sourceTree = "<group>";
		}};
		{I["productsGroup"]} /* Products */ = {{
			isa = PBXGroup;
			children = (
				{I["product"]} /* {T}.app */,
			);
			name = Products;
			sourceTree = "<group>";
		}};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		{I["target"]} /* {T} */ = {{
			isa = PBXNativeTarget;
			buildConfigurationList = {I["targetList"]} /* Build configuration list for PBXNativeTarget "{T}" */;
			buildPhases = (
				{I["sources"]} /* Sources */,
				{I["frameworks"]} /* Frameworks */,
				{I["resources"]} /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			name = {T};
			productName = {T};
			productReference = {I["product"]} /* {T}.app */;
			productType = "com.apple.product-type.application";
		}};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		{I["project"]} /* Project object */ = {{
			isa = PBXProject;
			attributes = {{
				BuildIndependentTargetsInParallel = 1;
				LastSwiftUpdateCheck = 1500;
				LastUpgradeCheck = 1500;
				TargetAttributes = {{
					{I["target"]} = {{
						CreatedOnToolsVersion = 15.0;
					}};
				}};
			}};
			buildConfigurationList = {I["projList"]} /* Build configuration list for PBXProject "{T}" */;
			compatibilityVersion = "Xcode 14.0";
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = {I["mainGroup"]};
			productRefGroup = {I["productsGroup"]} /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				{I["target"]} /* {T} */,
			);
		}};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		{I["resources"]} /* Resources */ = {{
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				{I["assetsBuild"]} /* Assets.xcassets in Resources */,
				{I["webBuild"]} /* Web in Resources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		}};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		{I["sources"]} /* Sources */ = {{
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
{src_files}
			);
			runOnlyForDeploymentPostprocessing = 0;
		}};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
		{I["projDebug"]} /* Debug */ = {{
			isa = XCBuildConfiguration;
			buildSettings = {{
				{proj_debug}
			}};
			name = Debug;
		}};
		{I["projRelease"]} /* Release */ = {{
			isa = XCBuildConfiguration;
			buildSettings = {{
				{proj_release}
			}};
			name = Release;
		}};
		{I["targetDebug"]} /* Debug */ = {{
			isa = XCBuildConfiguration;
			buildSettings = {{
				{target_settings}
			}};
			name = Debug;
		}};
		{I["targetRelease"]} /* Release */ = {{
			isa = XCBuildConfiguration;
			buildSettings = {{
				{target_settings}
			}};
			name = Release;
		}};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		{I["projList"]} /* Build configuration list for PBXProject "{T}" */ = {{
			isa = XCConfigurationList;
			buildConfigurations = (
				{I["projDebug"]} /* Debug */,
				{I["projRelease"]} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		}};
		{I["targetList"]} /* Build configuration list for PBXNativeTarget "{T}" */ = {{
			isa = XCConfigurationList;
			buildConfigurations = (
				{I["targetDebug"]} /* Debug */,
				{I["targetRelease"]} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		}};
/* End XCConfigurationList section */
	}};
	rootObject = {I["project"]} /* Project object */;
}}
'''
proj = os.path.join(here, f'{T}.xcodeproj')
os.makedirs(os.path.join(proj, 'xcshareddata', 'xcschemes'), exist_ok=True)
open(os.path.join(proj, 'project.pbxproj'), 'w').write(pbx)

scheme = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion = "1500" version = "1.7">
   <BuildAction parallelizeBuildables = "YES" buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry buildForTesting = "YES" buildForRunning = "YES" buildForProfiling = "YES" buildForArchiving = "YES" buildForAnalyzing = "YES">
            <BuildableReference BuildableIdentifier = "primary" BlueprintIdentifier = "{I["target"]}" BuildableName = "{T}.app" BlueprintName = "{T}" ReferencedContainer = "container:{T}.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction buildConfiguration = "Debug" selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv = "YES">
   </TestAction>
   <LaunchAction buildConfiguration = "Debug" selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle = "0" useCustomWorkingDirectory = "NO" ignoresPersistentStateOnLaunch = "NO" debugDocumentVersioning = "YES" debugServiceExtension = "internal" allowLocationSimulation = "YES">
      <BuildableProductRunnable runnableDebuggingMode = "0">
         <BuildableReference BuildableIdentifier = "primary" BlueprintIdentifier = "{I["target"]}" BuildableName = "{T}.app" BlueprintName = "{T}" ReferencedContainer = "container:{T}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction buildConfiguration = "Release" shouldUseLaunchSchemeArgsEnv = "YES" savedToolIdentifier = "" useCustomWorkingDirectory = "NO" debugDocumentVersioning = "YES">
      <BuildableProductRunnable runnableDebuggingMode = "0">
         <BuildableReference BuildableIdentifier = "primary" BlueprintIdentifier = "{I["target"]}" BuildableName = "{T}.app" BlueprintName = "{T}" ReferencedContainer = "container:{T}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction buildConfiguration = "Release" revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
'''
open(os.path.join(proj, 'xcshareddata', 'xcschemes', f'{T}.xcscheme'), 'w').write(scheme)
print('wrote', proj)
