// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

angular.module('mm.core')

/**
 * Directive to handle file attachments. The file is not downloaded automatically.
 *
 * @module mm.core
 * @ngdoc directive
 * @name mmAttachment
 * @description
 * Directive to handle file attachments. Shows the attachment name, icon (depending on mimetype) and a button
 * to download/refresh it.
 *
 * Required attributes:
 *     - attachment: Object with the following attributes:
 *         - filename: Name of the file.
 *         - fileurl: File URL.
 */
.directive('mmAttachment', function($q, $mmUtil, $mmFilepool, $mmSite, $mmApp, $mmEvents) {

    // Convenience function to get the file state and set scope variables based on it.
    function getState(scope, siteid, fileurl) {
        return $mmFilepool.getFileStateByUrl(siteid, fileurl).then(function(state) {
            scope.isDownloaded = state === $mmFilepool.FILEDOWNLOADED;
            scope.isDownloading = state === $mmFilepool.FILEDOWNLOADING;
        });
    }

    // Convenience function to download a file.
    function downloadFile(scope, siteid, fileurl, component, componentid) {
        scope.isDownloading = true;
        return $mmFilepool.downloadUrl(siteid, fileurl, true).then(function(localUrl) {
            $mmFilepool.addFileLinkByUrl(siteid, fileurl, component, componentid);
            scope.isDownloading = false;
            scope.isDownloaded = true;
            return localUrl;
        }, function() {
            $mmUtil.showErrorModal('mm.core.errordownloadingfile', true);
            return getState(scope, siteid, fileurl).then(function() {
                if (scope.isDownloaded) {
                    return localUrl;
                } else {
                    return $q.reject();
                }
            });
        });
    }

    return {
        restrict: 'E',
        templateUrl: 'core/templates/attachment.html',
        scope: {
            attachment: '='
        },
        link: function(scope, element, attrs) {
            var attachment = scope.attachment,
                fileurl = $mmSite.fixPluginfileURL(attachment.fileurl),
                filename = attachment.filename,
                siteid = $mmSite.getId(),
                component = attrs.component,
                componentid = attrs.componentId,
                eventName = $mmFilepool.getFileEventNameByUrl(siteid, fileurl);

            scope.filename = filename;
            scope.fileicon = $mmUtil.getFileIcon(filename);
            getState(scope, siteid, fileurl);

            var observer = $mmEvents.on(eventName, function(data) {
                if (data.success) {
                    scope.isDownloading = false;
                    scope.isDownloaded = true;
                } else {
                    $mmUtil.showErrorModal('mm.core.errordownloadingfile', true);
                    getState(scope, siteid, fileurl);
                }
            });

            scope.download = function(e, openAfterDownload) {
                e.preventDefault();
                e.stopPropagation();

                if (scope.isDownloading) {
                    return;
                }

                if (!$mmApp.isOnline() && (!openAfterDownload || (openAfterDownload && !scope.isDownloaded))) {
                    $mmUtil.showErrorModal('mm.core.networkerrormsg', true);
                    return;
                }

                if (openAfterDownload) {
                    // File needs to be opened now. If file needs to be downloaded, skip the queue.
                    downloadFile(scope, siteid, fileurl, component, componentid).then(function(localUrl) {
                        $mmUtil.openFile(localUrl);
                    });
                } else {
                    // File doesn't need to be opened, add it to queue.
                    $mmFilepool.invalidateFileByUrl(siteid, fileurl).finally(function() {
                        scope.isDownloading = true;
                        $mmFilepool.addToQueueByUrl(siteid, fileurl, component, componentid);
                    });
                }
            }

            scope.$on('$destroy', function() {
                observer.off();
            });
        }
    };
});
