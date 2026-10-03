"""Headless PyQGIS project creation and load/render verification."""
import os
from pathlib import Path
from .constants import TERRAIN_NAMES
from .safety import output_path,WORKSPACE_ROOT

def create_project(output,crs,destination):
    from qgis.PyQt.QtCore import QSettings
    from qgis.PyQt.QtGui import QColor
    from qgis.core import (QgsApplication,QgsProject,QgsVectorLayer,QgsCoordinateReferenceSystem,
                           QgsCategorizedSymbolRenderer,QgsRendererCategory,QgsFillSymbol,
                           QgsMapSettings,QgsMapRendererParallelJob,Qgis)
    profile = output_path(output/"qgis_profile")
    profile.mkdir(parents=True,exist_ok=True)
    QSettings.setPath(QSettings.Format.IniFormat,QSettings.Scope.UserScope,str(profile))
    QgsApplication.setPrefixPath(os.environ["QGIS_PREFIX_PATH"],True)
    app = QgsApplication([],False,str(profile),"external")
    if not Path(QgsApplication.qgisSettingsDirPath()).resolve().is_relative_to(WORKSPACE_ROOT):
        raise RuntimeError("QGIS profile escaped workspace")
    app.initQgis()
    project = QgsProject.instance()
    project.setFilePathStorage(Qgis.FilePathType.Relative)
    project.setTitle("GaiaGIS — mathematical FF7 spherical reconstruction")
    project.setCrs(QgsCoordinateReferenceSystem(crs["geographic"].ExportToWkt()))
    root = project.layerTreeRoot()
    colors = {0:"#78a865",1:"#3f7348",2:"#947d6b",3:"#346c96",6:"#4787a6",7:"#618c78",
              8:"#d4bd84",9:"#a58f75",10:"#e3eaf0",25:"#386b45",26:"#346c96",27:"#72687b"}
    surfaces = {}
    checks = []
    def add(group,path,name,label,visible):
        layer = QgsVectorLayer(str(path)+"|layername="+name,label,"ogr")
        if not layer.isValid() or not layer.crs().isValid():
            raise RuntimeError(f"QGIS failed to load {path}:{name}")
        categories = []
        for terrain in [-1,*range(32)]:
            color = "#346c96" if terrain==-1 else colors.get(terrain,"#a2a19a")
            symbol = QgsFillSymbol.createSimple({"color":color,"outline_style":"no"})
            categories.append(QgsRendererCategory(terrain,symbol,"Synthetic polar ocean" if terrain==-1 else f"{terrain}: {TERRAIN_NAMES[terrain]}"))
        layer.setRenderer(QgsCategorizedSymbolRenderer('coalesce("terrain_id", -1)',categories))
        metadata = layer.metadata()
        metadata.setAbstract("Derived Gaia reconstruction. FF7 gameplay terrain classes; synthetic ocean has NULL FF7 terrain and lineage. See docs/spherical-reconstruction.md.")
        layer.setMetadata(metadata)
        project.addMapLayer(layer,False)
        group.addLayer(layer).setItemVisibilityChecked(visible)
        checks.append(dict(layer=name,feature_count=layer.featureCount(),crs_description=layer.crs().description(),valid=True))
        return layer
    geo = root.addGroup("Gaia Geographic — longitude / latitude")
    surfaces["geographic"] = add(geo,output/"gis"/"gaia_geographic.gpkg","gaia_surface","Gaia surface — FF7 gameplay terrain",True)
    add(geo,output/"gis"/"gaia_geographic.gpkg","gaia_ff7_surface","Observed FF7 surface",False)
    add(geo,output/"gis"/"gaia_geographic.gpkg","gaia_polar_caps","Reconstructed polar ocean",False)
    for name,title in (("equirectangular","Plate Carree / Equirectangular"),("mercator","Mercator — latitude clipped"),
                       ("mollweide","Mollweide"),("orthographic","Orthographic — front hemisphere")):
        group = root.addGroup(title)
        surfaces[name] = add(group,output/"gis"/"gaia_projections.gpkg","gaia_"+name,title,True)
        group.setItemVisibilityChecked(False)
    raw = root.addGroup("GaiaGame — raw coordinate space")
    add(raw,output/"gis"/"gaia_raw.gpkg","gaia_raw_triangles","FF7 raw triangles",True)
    raw.setItemVisibilityChecked(False)
    project.viewSettings().setDefaultViewExtent(__import__("qgis.core",fromlist=["QgsReferencedRectangle"]).QgsReferencedRectangle(surfaces["geographic"].extent(),project.crs()))
    # Bookmarks carry destination CRS so each projection can be inspected as
    # its own map, rather than merely reprojected into the geographic canvas.
    from qgis.core import QgsBookmark,QgsReferencedRectangle
    for name,layer in surfaces.items():
        bookmark = QgsBookmark()
        bookmark.setName("Gaia "+name)
        bookmark.setGroup("GaiaGIS projection views")
        bookmark.setExtent(QgsReferencedRectangle(layer.extent(),layer.crs()))
        project.bookmarkManager().addBookmark(bookmark)
    destination = output_path(destination)
    destination.parent.mkdir(parents=True,exist_ok=True)
    if not project.write(str(destination)):
        raise RuntimeError("QGIS project write failed")
    plots = output_path(output/"reconstruction"/"plots")
    plots.mkdir(parents=True,exist_ok=True)
    from qgis.PyQt.QtCore import QSize
    for name,layer in surfaces.items():
        settings = QgsMapSettings()
        settings.setLayers([layer])
        settings.setDestinationCrs(layer.crs())
        settings.setExtent(layer.extent())
        settings.setOutputSize(QSize(1024,640))
        settings.setBackgroundColor(QColor("#f2f2f2"))
        job = QgsMapRendererParallelJob(settings)
        job.start()
        job.waitForFinished()
        if job.errors():
            raise RuntimeError(f"QGIS render error: {job.errors()}")
        if not job.renderedImage().save(str(plots/f"gaia_{name}.png")):
            raise RuntimeError("QGIS validation image save failed")
    # Test the actual saved archive, not just in-memory layer creation.
    loaded = QgsProject()
    if not loaded.read(str(destination)):
        raise RuntimeError("Saved QGZ failed to reopen")
    if any(not layer.isValid() for layer in loaded.mapLayers().values()):
        raise RuntimeError("Saved QGZ contains invalid layers")
    result = dict(qgis_version=Qgis.QGIS_VERSION,project=str(destination),reopened=True,
                  valid_layers=len(loaded.mapLayers()),layers=checks,validation_renders=list(surfaces),
                  profile=str(profile),default_canvas_crs="Gaia Geographic",projection_bookmarks=5)
    # Keep the application alive for the remainder of the process; tearing it
    # down before Python provider objects can crash some Windows QGIS builds.
    return result,app
