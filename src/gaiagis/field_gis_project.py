"""Optional offscreen QGIS project for a single, verified FieldLocal GeoPackage."""
# SPDX-License-Identifier: GPL-3.0-only
import os
from pathlib import Path
import tempfile
import time
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

from .clean_output import reject_links
from .safety import WORKSPACE_ROOT, output_path

RELATIONS = {
    'triangle_contacts':('interaction_candidates','walkmesh_triangles',[('field_id','field_id'),('triangle_id','triangle_id')]),
    'line_contacts':('line_contacts','script_lines',[('field_id','field_id'),('record_id','instruction_offset')]),
    'line_event_candidates':('event_interaction_candidates','script_lines',[('field_id','field_id'),('line_offset','instruction_offset')]),
    'event_candidates':('event_interaction_candidates','script_events',[('event_offset','instruction_offset')]),
    'instruction_owners':('script_instruction_owners','script_instructions',[('instruction_offset','instruction_offset')]),
    'entry_aliases':('script_entry_aliases','script_entries',[('root_offset','root_offset')]),
    'alias_owners':('script_instruction_owners','script_entry_aliases',[(k,k) for k in ('actor_id','kind','raw_slot','root_offset')]),
    'if_controls':('conditional_controls','script_conditions',[('if_offset','instruction_offset')]),
    'event_controls':('conditional_controls','script_events',[('target_offset','instruction_offset')]),
    'request_targets':('request_target_events','request_edges',[('source_offset','source_offset')]),
    'request_target_event':('request_target_events','script_events',[('target_offset','instruction_offset')]),
}
RAW = 'FieldLocal Undefined Cartesian. Use Cartesian Raw Unit / Raw Unit². QGIS may display Meter for this undefined coordinate space. Evidence relations support static research browsing.'
_application = None


def _application_for_project():
    global _application
    from qgis.core import QgsApplication
    from qgis.PyQt.QtCore import QSettings
    if QgsApplication.instance() is None:
        profile=output_path(WORKSPACE_ROOT/'output/dev/current/qgis-field-project')
        reject_links(profile)
        profile.mkdir(parents=True,exist_ok=True)
        QSettings.setPath(QSettings.Format.IniFormat,QSettings.Scope.UserScope,str(profile))
        os.environ.setdefault('QT_QPA_PLATFORM','offscreen')
        if 'QGIS_PREFIX_PATH' in os.environ:
            QgsApplication.setPrefixPath(os.environ['QGIS_PREFIX_PATH'],True)
        _application=QgsApplication([],False,str(profile),'external')
        if not Path(_application.qgisSettingsDirPath()).resolve().is_relative_to(WORKSPACE_ROOT):
            raise ValueError('QGIS profile outside workspace')
        _application.initQgis()


def create_field_project(package, target, tables, field):
    from .field_gis import INTERACTION_FIELDS, safe_target
    from qgis.core import (Qgis, QgsProject, QgsReferencedRectangle, QgsRelation, QgsVectorLayer)
    from qgis.core import QgsRelationContext
    started=time.perf_counter()
    safe_target(target,'.qgz')
    reject_links(package)
    _application_for_project()
    project=QgsProject()
    project.setFilePathStorage(Qgis.FilePathType.Relative)
    project.setTitle(f'GaiaGIS FieldLocal — {field}')
    metadata=project.metadata();metadata.setAbstract(RAW);project.setMetadata(metadata)
    groups={label:project.layerTreeRoot().addGroup(label) for label in
            ('Geometry','Interaction','Gameplay','Dialogue','Conditional Evidence')}
    layers={}
    try:
        with tempfile.TemporaryDirectory(prefix='.field-qgis-',dir=target.parent) as stage:
            pair=Path(stage)/package.name
            temporary=Path(stage)/target.name
            os.link(package,pair)
            def add(key,source,group,subset=None):
                layer=QgsVectorLayer(f'{pair}|layername={source}',key,'ogr')
                if not layer.isValid() or subset and not layer.setSubsetString(subset):
                    raise ValueError('QGIS layer readback')
                layer.setReadOnly(True)
                if layer.isSpatial():
                    md=layer.metadata();md.setAbstract(RAW);layer.setMetadata(md)
                project.addMapLayer(layer,False)
                groups[group].addLayer(layer).setItemVisibilityChecked(key in ('walkmesh_triangles','script_lines'))
                layers[key]=layer
            from .field_gis import table_fields
            base=table_fields(1)
            for table in tables:
                group=('Geometry' if table in base else
                       'Interaction' if table in INTERACTION_FIELDS or table=='event_interaction_candidates' else
                       'Gameplay' if table=='gameplay_events' else 'Dialogue' if table=='dialogue_references' else 'Conditional Evidence')
                add(table,table,group)
            add('line_contacts','interaction_candidates','Interaction',""" "record_type" = 'line' """.strip())
            triangles=layers['walkmesh_triangles']
            if triangles.crs().isValid():project.setCrs(triangles.crs())
            project.setEllipsoid('NONE')
            project.setDistanceUnits(Qgis.DistanceUnit.Unknown)
            project.setAreaUnits(Qgis.AreaUnit.Unknown)
            project.viewSettings().setDefaultViewExtent(QgsReferencedRectangle(triangles.extent(),triangles.crs()))
            for name,(child,parent,keys) in RELATIONS.items():
                relation=QgsRelation(QgsRelationContext(project))
                relation.setId(name);relation.setName(name.replace('_',' '))
                relation.setReferencingLayer(layers[child].id());relation.setReferencedLayer(layers[parent].id())
                for foreign,natural in keys:relation.addFieldPair(foreign,natural)
                if not relation.isValid():raise ValueError('QGIS relation readback')
                project.relationManager().addRelation(relation)
            project.setFileName(str(temporary))
            if not project.write():raise ValueError('QGIS project write')
            try:
                with ZipFile(temporary) as archive:
                    qgs=next(name for name in archive.namelist() if name.endswith('.qgs'))
                    xml=ElementTree.fromstring(archive.read(qgs))
            except (BadZipFile,StopIteration,ElementTree.ParseError) as error:
                raise ValueError('QGZ container readback') from error
            sources=[value.text.split('|',1)[0] for value in xml.findall('.//projectlayers/maplayer/datasource')]
            if not sources or set(sources)!={'./'+package.name}:raise ValueError('QGZ relative source readback')
            project.clear()
            if not project.read(str(temporary)) or len(project.mapLayers())!=len(layers) or any(not layer.isValid() for layer in project.mapLayers().values()):
                raise ValueError('Saved QGZ could not reopen')
            relations=project.relationManager().relations()
            if set(relations)!=set(RELATIONS) or any(not relation.isValid() for relation in relations.values()) or project.ellipsoid()!='NONE':
                raise ValueError('QGZ relationship/measurement readback')
            project.clear()
            safe_target(target,'.qgz');os.link(temporary,target)
    finally:
        project.clear()
    return dict(status='complete',filename=target.name,layers=len(layers),relations=len(RELATIONS),
                bytes=target.stat().st_size,seconds=round(time.perf_counter()-started,4),qgis=Qgis.QGIS_VERSION)
