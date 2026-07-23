"use client";

import { ImageZone } from "@/components/submit/ImageZone";
import { LocationPicker } from "@/components/submit/LocationPicker";
import { MetadataFields } from "@/components/submit/MetadataFields";
import { ResultsPanel } from "@/components/submit/ResultsPanel";
import { DesktopSidebar, AnalyzeButton } from "@/components/submit/NavWorkflow";
import { ArrowLeft } from "lucide-react";

export default function SubmitDesktop(props: any) {
    const {
        hook,
        systemParameters,
        activeParameters,
        enabledParamIds,
        toggleParam,
        verifyErrors,
        imagePreviews,
        imagePlotFiles,
        handleImageSelect,
        setNearestLocations,
        allLocations,
        setIsRecommending,
        step,
        results,
        resultEntries,
        router,
    } = props;

    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <canvas ref={hook.hiddenCanvasRef} className="hidden" />

            {/* ── Top Navigation Bar ── */}
            <div className="bg-card-general border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-text min-h-11">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-primary">ส่งตรวจคุณภาพน้ำ</h1>
                </div>
                <div className="w-15" />
            </div>

            {/* DESKTOP VIEW COMPONENT */}
            <div className="m-4">
                <div className="bg-card-general border border-border rounded-xl overflow-hidden flex min-h-150">
                    <DesktopSidebar {...hook} />
                    <div className="flex flex-col flex-1 border-r border-border p-4 gap-4 max-h-[70vh] overflow-y-auto">
                        {step === "upload"
                            ? systemParameters.map((param: any) => (
                                  <ImageZone
                                      key={param.id}
                                      param={param}
                                      step={step}
                                      preview={imagePreviews[param.id]}
                                      plotFile={imagePlotFiles[param.id]}
                                      measurement={results[param.id]}
                                      verifyError={verifyErrors[param.id]}
                                      onImageFilesChange={(file: File) => handleImageSelect(param.id, file)}
                                      onNearestLocationsUpdate={setNearestLocations}
                                      allLocations={allLocations}
                                      setIsRecommending={setIsRecommending}
                                      enabled={enabledParamIds.has(param.id)}
                                      onToggle={() => toggleParam(param.id)}
                                  />
                              ))
                            : step === "analyzing"
                              ? activeParameters.map((param: any) => (
                                    <ImageZone
                                        key={param.id}
                                        param={param}
                                        step={step}
                                        preview={imagePreviews[param.id]}
                                        plotFile={imagePlotFiles[param.id]}
                                        measurement={results[param.id]}
                                        verifyError={verifyErrors[param.id]}
                                        onImageFilesChange={(file: File) => handleImageSelect(param.id, file)}
                                        onNearestLocationsUpdate={setNearestLocations}
                                        allLocations={allLocations}
                                        setIsRecommending={setIsRecommending}
                                    />
                                ))
                              : resultEntries.map(({ key, param, measurement }: any) => (
                                    <ImageZone
                                        key={key}
                                        param={param}
                                        step={step}
                                        preview={imagePreviews[key]}
                                        plotFile={imagePlotFiles[key]}
                                        measurement={measurement}
                                        onImageFilesChange={() => {}}
                                        onNearestLocationsUpdate={setNearestLocations}
                                        allLocations={allLocations}
                                        setIsRecommending={setIsRecommending}
                                    />
                                ))}
                        {step === "upload" && <AnalyzeButton {...hook} />}
                    </div>
                    <div className="flex flex-col flex-1 p-4 gap-4">
                        {step === "upload" && (
                            <>
                                <LocationPicker {...hook} gpsCoords={hook.gpsCoords} exifCoords={hook.exifCoords} activeSource={hook.activeSource} onSelectSource={hook.onSelectSource} />{" "}
                                <MetadataFields {...hook} />
                            </>
                        )}
                        {step === "results" && <ResultsPanel setStep={hook.setStep} {...hook} />}{" "}
                    </div>
                </div>
            </div>
        </div>
    );
}
